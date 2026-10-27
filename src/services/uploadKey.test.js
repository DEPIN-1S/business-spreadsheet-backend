import test from "node:test";
import assert from "node:assert/strict";
import { uploadObjectKey } from "./r2.js";

test("keeps an upload path as an object key", () => {
    assert.equal(
        uploadObjectKey("/uploads/images/bill.jpg"),
        "uploads/images/bill.jpg"
    );
});

test("drops query strings and decodes the filename", () => {
    assert.equal(
        uploadObjectKey("/uploads/images/bill%20scan.jpg?download=1"),
        "uploads/images/bill scan.jpg"
    );
});

test("rejects paths outside uploads", () => {
    assert.equal(uploadObjectKey("/images/logo.png"), null);
    assert.equal(uploadObjectKey("/uploads/../.env"), null);
    assert.equal(uploadObjectKey("/uploads/%"), null);
});
