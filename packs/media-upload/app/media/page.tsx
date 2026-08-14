import { UploadForm } from "@/features/media";

/** DESIGN: replace after the Claude Design pass. Thin route hosting the uploader. */
export default function MediaPage() {
  return (
    <main className="container mx-auto py-12">
      <UploadForm />
    </main>
  );
}
