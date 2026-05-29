import assert from "node:assert/strict";
import test from "node:test";
import {
  getLessonCount,
  mapCourseSummary,
  mapThumbnail,
} from "../src/contentful/mapCourse.js";

test("getLessonCount returns 0 when courseLessons missing", () => {
  assert.equal(getLessonCount({ sys: { id: "x" }, fields: {} }), 0);
});

test("getLessonCount returns link array length without resolving lessons", () => {
  const entry = {
    sys: { id: "course-1" },
    fields: {
      courseName: "Test",
      courseRole: "Learner",
      courseLessons: [{ sys: { id: "l1" } }, { sys: { id: "l2" } }, { sys: { id: "l3" } }],
    },
  };
  assert.equal(getLessonCount(entry), 3);
});

test("mapThumbnail resolves Cloudinary image field on image entry", () => {
  const thumbnail = mapThumbnail({
    sys: { type: "Entry", id: "img-1", contentType: { sys: { id: "image" } } },
    fields: {
      altText: "Course cover",
      image: [
        {
          secure_url:
            "https://res.cloudinary.com/example/image/upload/v1/cover.png",
          width: 350,
          height: 200,
          public_id: "cover",
        },
      ],
    },
  });
  assert.equal(
    thumbnail?.url,
    "https://res.cloudinary.com/example/image/upload/v1/cover.png",
  );
  assert.equal(thumbnail?.width, 350);
  assert.equal(thumbnail?.height, 200);
});

test("mapThumbnail resolves image entry with nested asset field", () => {
  const thumbnail = mapThumbnail({
    sys: { type: "Entry", id: "img-1", contentType: { sys: { id: "image" } } },
    fields: {
      title: "Course cover",
      image: {
        sys: { type: "Asset", id: "asset-1" },
        fields: {
          title: "cover.jpg",
          file: {
            url: "//images.ctfassets.net/example/cover.jpg",
            details: { image: { width: 800, height: 450 } },
          },
        },
      },
    },
  });
  assert.equal(thumbnail?.url, "https://images.ctfassets.net/example/cover.jpg");
  assert.equal(thumbnail?.width, 800);
  assert.equal(thumbnail?.height, 450);
});

test("mapThumbnail resolves direct asset link", () => {
  const thumbnail = mapThumbnail({
    sys: { type: "Asset", id: "asset-1" },
    fields: {
      file: { url: "https://images.ctfassets.net/example/direct.jpg" },
    },
  });
  assert.equal(thumbnail?.url, "https://images.ctfassets.net/example/direct.jpg");
});

test("mapThumbnail returns null for unresolved link", () => {
  assert.equal(
    mapThumbnail({ sys: { type: "Link", linkType: "Entry", id: "img-1" } }),
    null,
  );
});

test("mapCourseSummary includes thumbnail from courseThumbnail Cloudinary image entry", () => {
  const summary = mapCourseSummary({
    sys: { id: "course-1" },
    fields: {
      courseName: "Course A",
      courseThumbnail: {
        sys: { type: "Entry", id: "img-1" },
        fields: {
          image: [
            {
              secure_url: "https://res.cloudinary.com/example/thumb.png",
              width: 100,
              height: 50,
            },
          ],
        },
      },
    },
  });
  assert.equal(summary.thumbnail?.url, "https://res.cloudinary.com/example/thumb.png");
});

test("mapCourseSummary includes lessonCount and sanitized courseRole", () => {
  const summary = mapCourseSummary({
    sys: { id: "course-1" },
    fields: {
      internalName: "internal",
      courseName: "Course A",
      courseRole: "Instructor",
      courseLessons: [{ sys: { id: "l1" } }],
      coursePrerequisite: [{ sys: { id: "pre-1" } }],
    },
  });
  assert.equal(summary.lessonCount, 1);
  assert.equal(summary.courseRole, "instructor");
  assert.deepEqual(summary.prerequisiteIds, ["pre-1"]);
  assert.equal(summary.courseName, "Course A");
});
