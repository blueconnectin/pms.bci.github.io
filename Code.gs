var EVIDENCE_DEFAULT_FOLDER_ID_ = '1t3eqlI9VK7y4Gt157bP4_YLKuyfSsM8B';

/** Serves the WhatsApp request form as a Google Apps Script Web App. */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Formulir pengajuan Invoice · Blue Connect')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

/** Uploads evidence into the admin-configured folder. Never grants public access. */
function uploadEvidence(input) {
  if (PropertiesService.getScriptProperties().getProperty('EVIDENCE_UPLOADS_READY') !== 'true') throw new Error('Admin perlu menjalankan authorizeEvidenceStorage terlebih dahulu.');
  var maxFile = 5 * 1024 * 1024, maxTotal = 10 * 1024 * 1024;
  if (!input || !/^[a-f0-9-]{36}$/i.test(input.requestId || '') || !Array.isArray(input.files) || input.files.length < 1 || input.files.length > 3) {
    throw new Error('Pilih 1–3 lampiran dengan total maksimal 10 MB.');
  }
  var folderId = PropertiesService.getScriptProperties().getProperty('UPLOAD_FOLDER_ID') || EVIDENCE_DEFAULT_FOLDER_ID_;
  if (!folderId) throw new Error('Folder bukti belum dikonfigurasi oleh admin.');
  var total = 0;
  var formats = {
    jpg:['image/jpeg','jpeg'], jpeg:['image/jpeg','jpeg'], png:['image/png','png'],
    webp:['image/webp','webp'], pdf:['application/pdf','pdf'],
    docx:['application/vnd.openxmlformats-officedocument.wordprocessingml.document','zip'],
    xlsx:['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet','zip']
  };
  var files = input.files.map(function(file) {
    if (!file || typeof file.name !== 'string' || file.name.length > 180 || typeof file.data !== 'string' || file.data.length > Math.ceil(maxFile / 3) * 4) throw new Error('Lampiran tidak valid atau lebih dari 5 MB.');
    var ext = file.name.split('.').pop().toLowerCase(), format = formats[ext];
    if (!format || (file.type && file.type !== format[0])) throw new Error('Gunakan JPG, PNG, WEBP, PDF, DOCX, atau XLSX.');
    if (!file.data || file.data.length % 4 !== 0 || !/^[A-Za-z0-9+/]*={0,2}$/.test(file.data)) throw new Error('Data lampiran tidak valid.');
    var bytes = Utilities.base64Decode(file.data), unsigned = bytes.slice(0,12).map(function(b) {return b & 255;});
    if (!bytes.length || bytes.length > maxFile) throw new Error('Ukuran per file maksimal 5 MB.');
    total += bytes.length;
    var magic = format[1], valid = false;
    if (magic === 'jpeg') valid = unsigned[0] === 255 && unsigned[1] === 216 && unsigned[2] === 255;
    if (magic === 'png') valid = [137,80,78,71,13,10,26,10].every(function(b,i) {return unsigned[i] === b;});
    if (magic === 'pdf') valid = [37,80,68,70,45].every(function(b,i) {return unsigned[i] === b;});
    if (magic === 'zip') valid = unsigned[0] === 80 && unsigned[1] === 75 && unsigned[2] === 3 && unsigned[3] === 4;
    if (magic === 'webp') valid = [82,73,70,70].every(function(b,i) {return unsigned[i] === b;}) && [87,69,66,80].every(function(b,i) {return unsigned[i+8] === b;});
    if (!valid) throw new Error('Isi file tidak cocok dengan format lampiran.');
    return {name:file.name.replace(/[\\/\r\n\x00-\x1f]/g,'_'), type:format[0], bytes:bytes};
  });
  if (total > maxTotal) throw new Error('Total lampiran maksimal 10 MB.');
  var digest = Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256, JSON.stringify(input.files));
  var cacheKey = 'evidence-' + input.requestId + '-' + Utilities.base64EncodeWebSafe(digest);
  var lock = LockService.getScriptLock(); lock.waitLock(30000);
  var created = [];
  try {
    var cache = CacheService.getScriptCache(), previous = cache.get(cacheKey);
    if (previous) return JSON.parse(previous);
    var folder;
    try {folder = DriveApp.getFolderById(folderId); folder.getName();}
    catch (error) {throw new Error('Folder bukti tidak dapat diakses. Admin perlu memeriksa UPLOAD_FOLDER_ID dan izin Drive.');}
    var result = files.map(function(file) {
      var stored = folder.createFile(Utilities.newBlob(file.bytes,file.type,Utilities.getUuid() + '-' + file.name));
      created.push(stored);
      return {name:file.name,url:stored.getUrl()};
    });
    cache.put(cacheKey,JSON.stringify(result),21600);
    return result;
  } catch (error) {
    created.forEach(function(file) {try {file.setTrashed(true);} catch (cleanupError) { /* Owner can remove partial files from the folder. */ }});
    throw new Error('Unggah bukti gagal. Periksa konfigurasi folder dan otorisasi Drive, lalu coba lagi.');
  } finally {lock.releaseLock();}
}

/** Run once from the Apps Script editor as the deployment owner to authorize Drive. */
function authorizeEvidenceStorage() {
  var folderId = PropertiesService.getScriptProperties().getProperty('UPLOAD_FOLDER_ID') || EVIDENCE_DEFAULT_FOLDER_ID_;
  if (!folderId) throw new Error('Isi UPLOAD_FOLDER_ID di Script Properties terlebih dahulu.');
  DriveApp.getFolderById(folderId).getName();
  PropertiesService.getScriptProperties().setProperties({UPLOAD_FOLDER_ID:folderId, EVIDENCE_UPLOADS_READY:'true'});
}

/** Non-sensitive capability flag; Drive is not accessed before owner authorization. */
function getEvidenceConfiguration() {
  return {enabled:PropertiesService.getScriptProperties().getProperty('EVIDENCE_UPLOADS_READY') === 'true'};
}
