import test from "node:test";
import assert from "node:assert/strict";
import { isAllowedUpload } from "./uploadPolicy.js";
import { isHeicUpload, prepareStoredBody } from "../services/prepareStoredFile.js";

test("accepts phone photo types the camera roll actually sends", () => {
    assert.equal(isAllowedUpload("image/heic", "IMG_0001.HEIC"), true);
    assert.equal(isAllowedUpload("image/heif", "photo.heif"), true);
    assert.equal(isAllowedUpload("", "IMG_0001.HEIC"), true);
    assert.equal(isAllowedUpload("application/octet-stream", "scan.jpg"), true);
    assert.equal(isAllowedUpload("image/jpeg", "1000005795.jpg"), true);
    assert.equal(isAllowedUpload("image/jpg", "camera.jpg"), true);
    assert.equal(isAllowedUpload("image/avif", "photo.avif"), true);
    assert.equal(isAllowedUpload("", "photo.avif"), true);
});

test("still rejects unknown uploads", () => {
    assert.equal(isAllowedUpload("application/octet-stream", "payload.exe"), false);
    assert.equal(isAllowedUpload("image/svg+xml", "icon.svg"), false);
    assert.equal(isAllowedUpload("", "notes.txt"), false);
});

test("jpeg uploads keep their bytes and name", async () => {
    const body = Buffer.from([0xff, 0xd8, 0xff, 0xd9]);
    const file = { mimetype: "image/jpeg", originalname: "bill.jpg" };
    const stored = await prepareStoredBody(file, "123-abc.jpg", body);
    assert.equal(stored.filename, "123-abc.jpg");
    assert.equal(stored.contentType, "image/jpeg");
    assert.equal(stored.body, body);
    assert.equal(isHeicUpload(file, "123-abc.jpg"), false);
});

test("a blank mime with a jpg extension is stored as jpeg", async () => {
    const body = Buffer.from([0xff, 0xd8]);
    const file = { mimetype: "", originalname: "IMG_9.jpg" };
    const stored = await prepareStoredBody(file, "123-abc.jpg", body);
    assert.equal(stored.contentType, "image/jpeg");
    assert.equal(stored.filename, "123-abc.jpg");
});

test("heic is detected from the mime type or the extension", () => {
    assert.equal(isHeicUpload({ mimetype: "image/heic", originalname: "a.jpg" }, "a.jpg"), true);
    assert.equal(isHeicUpload({ mimetype: "", originalname: "a.HEIC" }, "a.HEIC"), true);
    assert.equal(isHeicUpload({ mimetype: "image/jpeg", originalname: "a.jpg" }, "a.jpg"), false);
});
