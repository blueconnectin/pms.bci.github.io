/** Serves the WhatsApp request form as a Google Apps Script Web App. */
function doGet() {
  return HtmlService.createHtmlOutputFromFile('Index')
    .setTitle('Formulir Pengajuan · Blue Connect')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}
