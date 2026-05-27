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
        },
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
