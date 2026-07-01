import type { FastifyInstance, FastifyRequest, FastifyReply } from "fastify";
import { sendSuccess, sendError } from "../lib/errors.js";
import {
  createPresignedUploadUrl,
  cdnUrl,
  isValidPhotoType,
  fileExtFromContentType,
} from "../lib/s3.js";
import { requireProvider, type ProviderRequest } from "../middleware/auth.js";

export async function profilePhotoRoutes(app: FastifyInstance) {
  app.post(
    "/profile/photos/presign",
    {
      schema: {
        tags: ["Profile Photos"],
        summary: "Get a presigned S3 URL to upload a profile photo",
        description:
          "Returns a short-lived presigned PUT URL and the final CDN URL for a profile photo. " +
          "Steps: (1) call this endpoint to get uploadUrl + cdnUrl, " +
          "(2) PUT the image binary directly to uploadUrl with the matching Content-Type header, " +
          "(3) PATCH /api/auth/profile/:id with { photoUrl: cdnUrl } to save the URL.",
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
                  uploadUrl: { type: "string", description: "Presigned S3 PUT URL — valid for 5 minutes" },
                  cdnUrl:    { type: "string", description: "Permanent CDN URL to save as your photoUrl after upload" },
                },
              },
            },
          },
        },
      },
      preHandler: [requireProvider],
    },
    async (req: FastifyRequest, reply: FastifyReply) => {
      const userId = (req as ProviderRequest).providerId;
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
      const uploadUrl = await createPresignedUploadUrl(s3Key, contentType, 300);

      return sendSuccess(reply, 200, {
        uploadUrl,
        cdnUrl: cdnUrl(s3Key),
      });
    },
  );
}
