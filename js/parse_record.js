(function() {
  var schemes = [
    'http://www.',
    'https://www.',
    'http://',
    'https://',
    'urn:uuid:'
  ];

  var expansions = [
    '.com/',
    '.org/',
    '.edu/',
    '.net/',
    '.info/',
    '.biz/',
    '.gov/',
    '.com',
    '.org',
    '.edu',
    '.net',
    '.info',
    '.biz',
    '.gov',
  ];

  function parseRecord(scanRecord) {
    var data = new Uint8Array(scanRecord);

    var uri = tryParseURIBeacon(data);
    if (uri) return uri;

    var eddystone = tryParseEddystone(data);
    if (eddystone) return eddystone;

    return false;
  }

  function tryParseURIBeacon(data) {
    for (var b = 0; b < 8; b++) {
      if (data[b] === 0x03 && data[b + 1] === 0x03 &&
          data[b + 2] === 0xd8 && data[b + 3] === 0xfe) {
        break;
      }
    }

    if (b === 8) {
      return false;
    }

    b += 4;
    return parseAd(data, b);
  }

  function tryParseEddystone(data) {
    /*
        0x2, 0x1, 0x6, 0x3, 0x3, 0xaa, 0xfe, // eddystone header
        0x12, // length (?) -> 18
        0x16, // service data type value
        0xaa, 0xfe, // eddystone UUID
        0x10, // frame type == Eddystone URL
        0xdf, // TX Power
        0x2, // URL scheme
        0x6a, 0x61, 0x6e, 0x6a, 0x6f, 0x6e, 0x67, 0x62, 0x6f, 0x6f, 0x6d, 0x7, // Encoded URL + end of frame
    */

    // check header
    if (![0x2, 0x1, 0x6, 0x3, 0x3, 0xaa, 0xfe].every((c, ix) => data[ix] === c)) {
      return false;
    }

    return parseAd(data, 7); // 7 bytes since the start
  }

  // b is offset
  function parseAd(data, b) {
    var adLength = data[b++];
    var adType = data[b++];
    b += 2; // skip Service UUID
    var flags = data[b++];
    var txPower = data[b++];
    var scheme = data[b++];

    var text = schemes[scheme];
    // it has been 0x06 bytes since we read adLength, so take that into account
    for (var i = b, c = data[i]; i < b + adLength - 0x06; c = data[++i]) {
      if (c < expansions.length) {
        text += expansions[c];
      }
      else {
        text += String.fromCharCode(c);
      }
    }

    return { txPower: txPower, uri: text };
  }

  if (typeof module !== 'undefined') {
    module.exports = parseRecord;
  }
  if (typeof window !== 'undefined') {
    window.parseRecord = parseRecord;
  }
})();


