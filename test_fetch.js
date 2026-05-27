const token = "vercel_blob_rw_4dlZfN9MYOUoEHwI_Fvwip7ZakOE2milIVW6SDnFwM6XGtg";
const modelUrl = "https://4dlzfn9myouoehwi.private.blob.vercel-storage.com/models/model.onnx";

async function test() {
  try {
    console.log("Fetching Vercel Blob model URL...");
    const res = await fetch(modelUrl, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });
    console.log("Status Code:", res.status);
    console.log("Status Text:", res.statusText);
    console.log("Content-Type:", res.headers.get("content-type"));
    console.log("Content-Length:", res.headers.get("content-length"));
    if (!res.ok) {
      const text = await res.text();
      console.log("Error Response Text:", text);
    } else {
      console.log("Success! File metadata retrieved successfully.");
    }
  } catch (err) {
    console.error("Fetch Exception:", err);
  }
}

test();
