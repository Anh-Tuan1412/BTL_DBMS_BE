const {test} = require('node:test');
const assert = require('node:assert/strict');
const {repairText} = require('./repair-encoding.cjs');
test('repairs a UTF-8 string imported as latin1', () => {
  const text = 'Phòng chiếu — Gò Vấp';
  const broken = new TextDecoder('windows-1252').decode(Buffer.from(text));
  assert.equal(repairText(broken), text);
});
test('leaves correct Vietnamese and ASCII text alone', () => {
  for (const text of ['Phòng chiếu', 'Gò Vấp', 'Dune: Part Two', 'customer@example.com', 'A1', '']) assert.equal(repairText(text), null);
});
test('does not turn incomplete or invalid UTF-8 byte sequences into replacement characters', () => {
  assert.equal(repairText('Café'), null);
  assert.equal(repairText('😀'), null);
});
