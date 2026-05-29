const hfToken = "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";
const modelUrl = "https://huggingface.co/Kingman9407/hornet/resolve/main/model.onnx";

async function testFetch() {
  console.log("Testing fetch with redirect manual...");
  const headers = new Headers();
  headers.set("Authorization", `Bearer ${hfToken}`);
  
  // Test 1: fetch with default redirect follow
  try {
    const res1 = await fetch(modelUrl, {
      headers,
    });
    console.log("Test 1 (Default redirect):", res1.status, res1.statusText);
    console.log("Test 1 URL:", res1.url);
  } catch (err) {
    console.error("Test 1 Error:", err);
  }

  // Test 2: fetch with manual redirect to see the 302 and then fetch without auth
  try {
    const res2 = await fetch(modelUrl, {
      headers,
      redirect: "manual",
    });
    console.log("Test 2 (Manual redirect status):", res2.status, res2.statusText);
    const location = res2.headers.get("location");
    console.log("Test 2 Redirect Location:", location);
    if (location) {
      const res3 = await fetch(location); // no auth header!
      console.log("Test 3 (Fetch redirect URL without auth):", res3.status, res3.statusText);
    }
  } catch (err) {
    console.error("Test 2 Error:", err);
  }
}

testFetch();
