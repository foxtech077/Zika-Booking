import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { sendSuccess, sendError } from "../lib/errors.js";
import {
  createPresignedUploadUrl,
  createPresignedDownloadUrl,
  cdnUrl,
  isValidPhotoType,
  fileExtFromContentType,
} from "../lib/s3.js";
import { requireUser, type AuthRequest } from "../middleware/auth.js";

export async function profilePhotoRoutes(app: FastifyInstance) {
  app.post(
    "/profile/photos/presign",
    {
      schema: {
        tags: ["Profile Photos"],
        summary: "Get a presigned S3 URL to upload a profile photo",
        description:
          "Returns a presigned PUT URL, a permanent cdnUrl (save this to the profile), and a short-lived previewUrl (use this to display the image immediately after upload). " +
          "Steps: (1) call this endpoint, " +
          "(2) PUT the image binary to uploadUrl with the matching Content-Type header, " +
          "(3) display using previewUrl right away, " +
          "(4) PATCH /api/auth/profile/:id with { photoUrl: cdnUrl } to persist the URL.",
        security: [{ bearerAuth: [] }],
        body: {
          type: "object",
          required: ["contentType"],
          properties: {
            contentType: {
              type: "string",
              enum: ["image/jpeg", "image/png", "image/webp"],
              description: "MIME type of the image you will upload",
            },
          },
        },
        response: {
          200: {
            type: "object",
            properties: {
              success: { type: "boolean" },
              data: {
                type: "object",
                properties: {
                  uploadUrl:  { type: "string", description: "Presigned S3 PUT URL — valid for 5 minutes" },
                  cdnUrl:     { type: "string", description: "Permanent raw URL — save this as photoUrl via PATCH /auth/profile/:id" },
                  previewUrl: { type: "string", description: "Presigned S3 GET URL — use this to display the image immediately after upload (valid 15 minutes)" },
                },
              },
            },
          },
        },
      },
      preHandler: [requireUser],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = (req as AuthRequest).authId;
      const { contentType } = req.body as { contentType: string };

      if (!isValidPhotoType(contentType)) {
        return sendError(
          reply,
          422,
          "INVALID_CONTENT_TYPE",
          "Allowed content types: image/jpeg, image/png, image/webp.",
        );
      }

      const ext    = fileExtFromContentType(contentType);
      const s3Key  = `profiles/${userId}/${Date.now()}.${ext}`;
      const [uploadUrl, previewUrl] = await Promise.all([
        createPresignedUploadUrl(s3Key, contentType, 300),
        createPresignedDownloadUrl(s3Key, 900),
      ]);

      return sendSuccess(reply, 200, {
        uploadUrl,
        cdnUrl: cdnUrl(s3Key),
        previewUrl,
      });
    },
  );
}
