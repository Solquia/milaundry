import { convertFormDataAsync } from 'expo/src/winter/fetch/convertFormData';
import { installFormDataPatch } from 'expo/src/winter/FormData';

// expo/fetch (the global fetch since SDK 57) refuses RN's { uri } file parts;
// uploadImage hands it a bytes() part instead. See lib/imagekit.ts.
test('expo/fetch rejects a uri file part and encodes a bytes() one', async () => {
  const mod = require('react-native/Libraries/Network/FormData');
  const RNFormData = mod.default ?? mod;
  installFormDataPatch(RNFormData);
  const form = new RNFormData();
  form.append('fileName', 'a.jpg');
  const old = new RNFormData(); old.entries = function* () { yield* old._parts; }; old.append('file', { uri: 'file:///x.jpg', name: 'a.jpg', type: 'image/jpeg' });
  await expect(convertFormDataAsync(old, 'B')).rejects.toThrow('Unsupported FormDataPart implementation');
  form.append('file', { name: 'a.jpg', type: 'image/jpeg', size: 3, bytes: async () => new Uint8Array([1, 2, 3]) } as any);
  form.entries = function* () { yield* form._parts; };
  const { body } = await convertFormDataAsync(form, 'B');
  const text = Buffer.from(body).toString('latin1');
  expect(text).toContain('filename="a.jpg"');
  expect(text).toContain('content-type: image/jpeg');
  expect(text).toContain('\u0001\u0002\u0003');
});
