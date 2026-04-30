export const uploadToImgBB = async (file: any): Promise<string> => {
  try {
    const apiKey = process.env.IMGBB_API_KEY;

    if (!apiKey) {
      throw new Error("IMGBB_API_KEY is missing");
    }

    // convert stream → buffer
    const chunks: Buffer[] = [];
    for await (const chunk of file) {
      chunks.push(chunk);
    }
    const buffer = Buffer.concat(chunks);

    // buffer → base64
    const base64 = buffer.toString("base64");

    const formData = new FormData();
    formData.append("image", base64);

    const response = await fetch(
      `https://api.imgbb.com/1/upload?key=${apiKey}`,
      {
        method: "POST",
        body: formData,
      }
    );

    const data = await response.json();

    if (!data.success) {
      console.error(data);
      throw new Error("Image upload failed");
    }

    return data.data.url;
  } catch (error) {
    console.error("ImgBB upload error:", error);
    throw error;
  }
};