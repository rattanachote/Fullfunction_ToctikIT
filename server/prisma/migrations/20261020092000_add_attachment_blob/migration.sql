-- CreateTable
CREATE TABLE "AttachmentBlob" (
    "id" SERIAL NOT NULL,
    "attachmentId" INTEGER NOT NULL,
    "data" BYTEA NOT NULL,

    CONSTRAINT "AttachmentBlob_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AttachmentBlob_attachmentId_key" ON "AttachmentBlob"("attachmentId");

-- AddForeignKey
ALTER TABLE "AttachmentBlob" ADD CONSTRAINT "AttachmentBlob_attachmentId_fkey" FOREIGN KEY ("attachmentId") REFERENCES "Attachment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
