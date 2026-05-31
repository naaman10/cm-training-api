import swaggerJsdoc from "swagger-jsdoc";
import swaggerUi from "swagger-ui-express";

/**
 * Swagger / OpenAPI is enabled only when NODE_ENV is not production.
 *
 * Developers: add `@openapi` JSDoc paths on each handler (see routes/*.js).
 * All route files under `src/routes/` are scanned automatically.
 */

const baseDefinition = {
  openapi: "3.0.3",
  info: {
    title: "CM Training API",
    version: "0.1.0",
    description:
      "Driving instructor training API. **Swagger is available in development only.**",
  },
  components: {
    securitySchemes: {
      bearerAuth: {
        type: "http",
        scheme: "bearer",
        bearerFormat: "JWT",
        description:
          "Auth0 access token with correct **audience** (API Identifier). Permissions come from RBAC.",
      },
    },
    schemas: {
      SafeUserProfile: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          email: { type: "string", format: "email" },
          firstName: { type: "string", nullable: true },
          lastName: { type: "string", nullable: true },
          role: { type: "string" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          lastLoginAt: {
            type: "string",
            format: "date-time",
            nullable: true,
            description: "UTC instant from Neon (timestamptz)",
          },
          lastLoginAtUk: {
            type: "string",
            nullable: true,
            description: "Formatted for Europe/London (en-GB)",
          },
        },
      },
      SafeAdminUser: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          email: { type: "string", format: "email" },
          firstName: { type: "string", nullable: true },
          lastName: { type: "string", nullable: true },
          role: { type: "string" },
          status: { type: "string", example: "active" },
          createdAt: { type: "string", format: "date-time" },
          updatedAt: { type: "string", format: "date-time" },
          lastLoginAt: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          lastLoginAtUk: {
            type: "string",
            nullable: true,
          },
        },
      },
      CourseThumbnail: {
        type: "object",
        properties: {
          url: { type: "string", format: "uri" },
          title: { type: "string", nullable: true },
          width: { type: "integer", nullable: true },
          height: { type: "integer", nullable: true },
        },
      },
      SafeCourseSummary: {
        type: "object",
        description:
          "Course summary from Contentful. lessonCount only — no lesson array.",
        properties: {
          id: { type: "string", description: "Contentful entry id" },
          internalName: { type: "string", nullable: true },
          courseName: { type: "string", nullable: true },
          courseDescription: {
            type: "object",
            nullable: true,
            description: "Contentful Rich Text document",
          },
          courseRole: {
            type: "string",
            nullable: true,
            enum: ["admin", "instructor", "learner"],
          },
          completionCriteria: { type: "integer", nullable: true },
          lessonCount: {
            type: "integer",
            description: "Number of linked lessons (content not included)",
          },
          thumbnail: {
            allOf: [{ $ref: "#/components/schemas/CourseThumbnail" }],
            nullable: true,
          },
          prerequisiteIds: {
            type: "array",
            items: { type: "string" },
          },
          enrollmentStatus: {
            type: "string",
            enum: ["available", "enrolled", "completed"],
          },
          enrolledAt: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          enrolledAtUk: { type: "string", nullable: true },
          completedAt: {
            type: "string",
            format: "date-time",
            nullable: true,
          },
          completedAtUk: { type: "string", nullable: true },
        },
      },
      CourseEnrollment: {
        type: "object",
        properties: {
          id: { type: "string", format: "uuid" },
          courseId: { type: "string" },
          status: { type: "string", enum: ["enrolled", "completed"] },
          enrolledAt: { type: "string", format: "date-time", nullable: true },
          enrolledAtUk: { type: "string", nullable: true },
          completedAt: { type: "string", format: "date-time", nullable: true },
          completedAtUk: { type: "string", nullable: true },
        },
      },
      CoursePrerequisite: {
        type: "object",
        properties: {
          id: { type: "string" },
          courseName: { type: "string", nullable: true },
        },
      },
      SafeCourseDetail: {
        allOf: [
          { $ref: "#/components/schemas/SafeCourseSummary" },
          {
            type: "object",
            properties: {
              prerequisites: {
                type: "array",
                items: { $ref: "#/components/schemas/CoursePrerequisite" },
              },
            },
          },
        ],
      },
    },
  },
};

/**
 * Dev-only CSP: Swagger UI needs inline scripts; default helmet CSP blocks them.
 */
export function swaggerHelmetOptions(isProduction) {
  if (isProduction) {
    return {};
  }
  return { contentSecurityPolicy: false };
}

export function attachSwaggerDocs(app) {
  if (process.env.NODE_ENV === "production") {
    return;
  }

  const openapiSpec = swaggerJsdoc({
    definition: baseDefinition,
    apis: ["./src/routes/**/*.js"],
  });

  app.use(
    "/api-docs",
    swaggerUi.serve,
    swaggerUi.setup(openapiSpec, {
      explorer: true,
      customCss: ".swagger-ui .topbar { display: none }",
    }),
  );
}
