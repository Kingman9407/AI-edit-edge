const https = require('https');

https.get('https://raw.githubusercontent.com/Kingman9407/AI-edit-openrouter/main/trainer/fine_tuned_smollm_onnx/model.onnx', (res) => {
  console.log('raw.githubusercontent.com status:', res.statusCode);
  res.on('data', (d) => process.stdout.write(d.toString().slice(0, 100)));
});

https.get('https://media.githubusercontent.com/media/Kingman9407/AI-edit-openrouter/main/trainer/fine_tuned_smollm_onnx/model.onnx', (res) => {
  console.log('\nmedia.githubusercontent.com status:', res.statusCode);
  console.log('Headers:', res.headers);
});
