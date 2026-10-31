/** Private portal persistence and authorization. Called only after signed bridge verification. */
function portalBook_() {var id=PropertiesService.getScriptProperties().getProperty('SUBMISSION_SPREADSHEET_ID');if(!id)throw new Error('Aktifkan catatan Sheets terlebih dahulu.');return SpreadsheetApp.openById(id);}
function portalTable_(name){var book=portalBook_(),sheet=book.getSheetByName('Portal_'+name);if(!sheet){sheet=book.insertSheet('Portal_'+name);sheet.appendRow(['Key','JSON']);sheet.setFrozenRows(1);}var head=sheet.getRange(1,1,1,2).getValues()[0];if(head[0]!=='Key'||head[1]!=='JSON')throw Error('Header portal berbeda.');return sheet;}
function portalRows_(name){var sheet=portalTable_(name);return sheet.getLastRow()>1?sheet.getRange(2,1,sheet.getLastRow()-1,2).getValues().map(function(row){return {key:row[0],value:JSON.parse(row[1])};}):[];}
function portalGet_(name,key){var row=portalRows_(name).find(function(r){return r.key===key;});return row?row.value:null;}
function portalPut_(name,key,value){var text=JSON.stringify(value);if(text.length>44000)throw Error('Data portal terlalu besar.');var sheet=portalTable_(name),rows=portalRows_(name),index=rows.findIndex(function(r){return r.key===key;}),target=index<0?sheet.getLastRow()+1:index+2;sheet.getRange(target,1,1,2).setNumberFormat('@').setValues([["'"+key,"'"+text]]);SpreadsheetApp.flush();}
function portalAdmin_(account){return account.email==='blueconecin@gmail.com';}
function portalPublic_(account){return {id:account.id,email:account.email,name:account.name,role:portalAdmin_(account)?'ADMIN':'PEMOHON',profile:account.profile||null};}
function portalComplete_(profile){return !!(profile&&profile.name&&profile.phone&&profile.address&&profile.bank&&profile.accountNumber&&profile.accountOwner);}
function portalActor_(actor){if(!actor||!actor.id||!actor.email)throw Error('Silakan masuk kembali.');var a=portalGet_('Akun',actor.email);if(!a||a.id!==actor.id||(a.sessionVersion||1)!==actor.sessionVersion||a.disabled)throw Error('Sesi tidak berlaku.');return a;}
function portalOwn_(account,invoice){if(!invoice||(!portalAdmin_(account)&&invoice.owner!==account.id))throw Error('Pengajuan tidak ditemukan.');return invoice;}
function portalHistory_(invoice,account,action,note){invoice.updatedAt=new Date().toISOString();invoice.history=invoice.history||[];invoice.history.push({at:invoice.updatedAt,by:account.email,action:action,note:note||''});}
function portalCredential_(input){var email=recordText_(input.email,'Email',254).toLowerCase();return portalGet_('Akun',email);}
function portalAuth_(action,input){
 var lock=LockService.getScriptLock();lock.waitLock(30000);
 try {
  var props=PropertiesService.getScriptProperties();
  if(action==='lookup')return portalCredential_(input);
  if(action==='attempt'){
   var key='portal-attempt-'+Utilities.base64EncodeWebSafe(Utilities.computeDigest(Utilities.DigestAlgorithm.SHA_256,String(input.email))),cache=CacheService.getScriptCache(),count=Number(cache.get(key)||0);
   if(count>=(String(input.email).indexOf('ip:')===0?60:8))throw Error('Terlalu banyak percobaan. Coba kembali 15 menit lagi.');cache.put(key,String(count+1),900);return {allowed:true};
  }
  if(action==='password'){
   var user=portalActor_(input.actor);
   if(!/^[A-Za-z0-9_-]{16,100}$/.test(input.salt||'')||!/^[A-Za-z0-9_-]{40,100}$/.test(input.verifier||'')||input.algorithm!=='pbkdf2-sha256-100000+hmac-v1')throw Error('Hash password tidak valid.');
   user.salt=input.salt;user.verifier=input.verifier;user.algorithm=input.algorithm;user.sessionVersion=(user.sessionVersion||1)+1;portalPut_('Akun',user.email,user);return {id:user.id,email:user.email,name:user.name,sessionVersion:user.sessionVersion};
  }
  if(action==='register'){
   var existing=portalCredential_(input);if(existing)throw Error('Email sudah terdaftar.');
   if(!/^[A-Za-z0-9_-]{16,100}$/.test(input.salt||'')||!/^[A-Za-z0-9_-]{40,100}$/.test(input.verifier||'')||input.algorithm!=='pbkdf2-sha256-100000+hmac-v1')throw Error('Data akun tidak valid.');
   var account={id:Utilities.getUuid(),email:input.email.toLowerCase(),name:recordText_(input.name,'Nama',120),salt:input.salt,verifier:input.verifier,algorithm:input.algorithm,sessionVersion:1,createdAt:new Date().toISOString()};
   portalPut_('Akun',account.email,account);props.setProperty('PORTAL_AUTH_REQUIRED','true');return portalPublic_(account);
  }
  throw Error('Aksi autentikasi tidak dikenal.');
 }finally{lock.releaseLock();}
}
function portalItems_(data){
 var tariffs=portalRows_('Tarif').map(function(r){return r.value;});
 function item(description,qty,unit,amount){var rate=amount;if(rate==null){var found=tariffs.find(function(t){return t.projectType===data.projectType&&t.type===data.requestType&&t.unit===unit;});rate=found?found.price:null;}var total=rate==null?null:Math.round(qty*rate);if(total!==null&&(!Number.isSafeInteger(total)||total<=0))throw Error('Nilai invoice di luar batas.');return {description:description,qty:qty,unit:unit,price:rate,amount:total};}
 if(data.requestType==='Reimburst')return data.reimbursementItems.map(function(r){return item(r.object,1,'Pengeluaran',Number(r.amount));});
 var qty=data.requestCategory==='Projek'?Number(data.projectWorkQuantity):(data.requestType==='Sales'?Number(data.salesCount):1);
 var unit=data.requestCategory==='Projek'?data.projectWorkUnit:(data.requestType==='Sales'?'Sales':(data.requestType==='Manage Service'?'Periode':'Pengajuan'));
 return [item(data.requestType,qty,unit,null)];
}
function portalPrice_(invoice){invoice.items=portalItems_(invoice.data);invoice.priced=invoice.items.every(function(i){return i.price!==null;});invoice.total=invoice.priced?invoice.items.reduce(function(t,i){return t+i.amount;},0):null;if(invoice.total!==null&&!Number.isSafeInteger(invoice.total))throw Error('Total terlalu besar.');}
function portalEvidence_(input,existing,owner,invoiceId){
 var match=String(input.folderUrl||'').match(/^https:\/\/drive\.google\.com\/drive\/folders\/([A-Za-z0-9_-]+)$/);if(!match)throw Error('Folder bukti tidak valid.');
 var folder=DriveApp.getFolderById(match[1]),parents=folder.getParents(),ok=false,root=PropertiesService.getScriptProperties().getProperty('UPLOAD_FOLDER_ID')||EVIDENCE_DEFAULT_FOLDER_ID_;
 while(parents.hasNext())if(parents.next().getId()===root)ok=true;if(!ok)throw Error('Folder bukti tidak sesuai.');
 var binding=portalGet_('Bukti',match[1]);if(binding&&(binding.owner!==owner||binding.invoiceId!==invoiceId))throw Error('Folder bukti sudah dipakai pengajuan lain.');
 if(existing&&existing.folderUrl===input.folderUrl)return existing.evidence;
 var cache=CacheService.getScriptCache();if(cache.get('evidence-owner-'+match[1])!==input.uploadRequestId)throw Error('Bukti bukan milik sesi unggah ini.');
 var manifest=JSON.parse(cache.get('evidence-files-'+match[1])||'null');if(!manifest||!manifest.length)throw Error('Sesi bukti kedaluwarsa. Unggah ulang.');
 var evidence=manifest.map(function(m){var file=DriveApp.getFileById(m.id);return {fileId:m.id,name:file.getName(),url:file.getUrl(),folderUrl:folder.getUrl()};});
 portalPut_('Bukti',match[1],{owner:owner,invoiceId:invoiceId});return evidence;
}
function portalDispatch_(action,input,actor){
 var lock=LockService.getScriptLock();lock.waitLock(30000);
 try {
  var account=portalActor_(actor),admin=portalAdmin_(account);input=input||{};
  if(action==='me')return portalPublic_(account);
  if(action==='profile'){
   var p=input.profile||{},profile={name:recordText_(p.name,'Nama penerbit',120),phone:recordText_(p.phone,'WhatsApp',30),address:recordText_(p.address,'Alamat',500),bank:recordText_(p.bank,'Bank',80),accountNumber:recordText_(p.accountNumber,'Nomor rekening',40),accountOwner:recordText_(p.accountOwner,'Nama pemilik rekening',120)};
   if(!/^\d{1,40}$/.test(profile.accountNumber)||!/^\+?[0-9 ()-]{8,30}$/.test(profile.phone))throw Error('Rekening atau nomor WhatsApp tidak valid.');account.profile=profile;account.name=profile.name;portalPut_('Akun',account.email,account);return portalPublic_(account);
  }
  if(action==='tariffs')return portalRows_('Tarif').map(function(r){return r.value;});
  if(action==='saveTariff'){
   if(!admin)throw Error('Hanya admin proyek.');var t=input.tariff||{};
   if(['FTTH','FWA'].indexOf(t.projectType)<0||['Sales','Periode','Pengajuan','Pcs','Meter','Buah'].indexOf(t.unit)<0||!Number.isSafeInteger(Number(t.price))||Number(t.price)<=0)throw Error('Tarif tidak valid.');
   t={projectType:t.projectType,type:recordText_(t.type,'Jenis pekerjaan',80),unit:t.unit,price:Number(t.price),updatedBy:account.email,updatedAt:new Date().toISOString()};portalPut_('Tarif',JSON.stringify([t.projectType,t.type,t.unit]),t);return t;
  }
  if(action==='list')return portalRows_('Invoice').map(function(r){return r.value;}).filter(function(i){return admin||i.owner===account.id;}).map(function(i){return {id:i.id,number:i.number||'',applicant:i.profile.name,type:i.data.requestType,status:i.status,total:i.total,updatedAt:i.updatedAt};}).sort(function(a,b){return b.updatedAt.localeCompare(a.updatedAt);});
  if(action==='draft'){
   if(admin)throw Error('Pembuatan invoice menggunakan akun Pemohon.');
   if(!portalComplete_(account.profile))throw Error('Lengkapi Profil Saya terlebih dahulu.');
   if(!/^[a-f0-9-]{36}$/i.test(input.id||''))throw Error('ID draft tidak valid.');
   var old=portalGet_('Invoice',input.id);if(old&&(old.owner!==account.id||['DRAFT','REVISION'].indexOf(old.status)<0))throw Error('Draft tidak dapat diubah.');
   var source=input.data||{},data={},allowed=['requestDate','projectType','requestCategory','requestType','salesPeriodStart','salesPeriodEnd','salesCount','managePeriodStart','managePeriodEnd','projectWorkDateMode','projectWorkDateStart','projectWorkDateEnd','projectWorkQuantity','projectWorkUnit','projectWorkNote','operationalWorkDateMode','operationalWorkDateStart','operationalWorkDateEnd','operationalWorkNote','reimbursementItems'];
   allowed.forEach(function(key){if(Object.prototype.hasOwnProperty.call(source,key))data[key]=JSON.parse(JSON.stringify(source[key]));});
   if(Array.isArray(data.reimbursementItems))data.reimbursementItems=data.reimbursementItems.map(function(item){return {object:item.object,amount:item.amount};});
   data.applicant=account.profile.name;data.bank=account.profile.bank;data.accountNumber=account.profile.accountNumber;data.accountOwner=account.profile.accountOwner;normalizeRecord_(data);
   var invoice=old||{id:input.id,owner:account.id,status:'DRAFT',createdAt:new Date().toISOString(),history:[]};
   var evidence=portalEvidence_(input,old,account.id,invoice.id);invoice.data=data;invoice.profile=JSON.parse(JSON.stringify(account.profile));invoice.email=account.email;invoice.folderUrl=input.folderUrl;invoice.evidence=evidence;
   var folder=DriveApp.getFolderById(invoice.folderUrl.match(/\/folders\/([A-Za-z0-9_-]+)/)[1]),folderName=evidenceFolderName_({applicant:data.applicant,requestType:data.requestType,requestDate:data.requestDate});
   renameEvidenceBatch_(folder,folderName,evidenceFileManifest_(evidence));invoice.evidence.forEach(function(file,index){file.name=evidenceFileName_(folderName,index,file.name.split('.').pop());});
   portalPrice_(invoice);invoice.priceConfirmed=false;portalHistory_(invoice,account,'SAVE_DRAFT');portalPut_('Invoice',invoice.id,invoice);return invoice;
  }
  var inv=portalOwn_(account,portalGet_('Invoice',input.id));
  if(action==='get'){var view=JSON.parse(JSON.stringify(inv));view.displayDetails=portalDetailLines_(inv.data);return view;}
  if(action==='submit'){
   if(inv.owner!==account.id||['DRAFT','REVISION'].indexOf(inv.status)<0)throw Error('Pengajuan tidak dapat diajukan.');
   // Prices shown in the draft are the ones the applicant submits, not a new live tariff.
   inv.status='SUBMITTED';inv.priceConfirmed=inv.priced;portalHistory_(inv,account,'SUBMIT');
  } else if(action==='confirm'){
   if(inv.owner!==account.id||inv.status!=='CONFIRMATION'||!inv.priced)throw Error('Konfirmasi tidak tersedia.');inv.priceConfirmed=true;inv.status='SUBMITTED';portalHistory_(inv,account,'CONFIRM_PRICE');
  } else if(action==='review'){
   if(!admin||inv.status!=='SUBMITTED')throw Error('Pengajuan tidak dapat direview.');
   var decision=input.decision,note=input.note||'';
   if(decision==='REVISION'||decision==='REJECTED'){inv.status=decision;note=recordText_(note,'Catatan admin',1000);}
   else if(decision==='APPROVED'){
    if(!inv.priced||!inv.priceConfirmed)throw Error('Tarif dan nilai harus dikonfirmasi pemohon terlebih dahulu.');
    var props=PropertiesService.getScriptProperties(),sequence=Number(props.getProperty('PORTAL_INVOICE_SEQUENCE')||0)+1;props.setProperty('PORTAL_INVOICE_SEQUENCE',String(sequence));
    inv.number='INV/BCI/'+new Date().toISOString().slice(0,7).replace('-','')+'/'+('000000'+sequence).slice(-6);inv.status='APPROVED';inv.approvedAt=new Date().toISOString();inv.approvedBy=account.email;
    var pdf=portalCreatePdf_(inv);inv.pdfId=pdf.getId();
   } else throw Error('Keputusan tidak valid.');portalHistory_(inv,account,decision,note);
  } else if(action==='reprice'){
   if(!admin||inv.status!=='SUBMITTED')throw Error('Nilai tidak dapat diubah.');var reason=recordText_(input.note,'Catatan perubahan',1000);
   if(input.salesCount!==undefined&&inv.data.requestType==='Sales'){var quantity=Number(input.salesCount);if(!Number.isSafeInteger(quantity)||quantity<1)throw Error('Jumlah sales tidak valid.');inv.data.salesCount=String(quantity);}
   portalPrice_(inv);if(!inv.priced)throw Error('Lengkapi tarif sebelum menghitung ulang.');inv.priceConfirmed=false;inv.status='CONFIRMATION';portalHistory_(inv,account,'REPRICE',reason);
  } else if(action==='pdf'){
   if(inv.status!=='APPROVED'||!inv.pdfId)throw Error('PDF hanya tersedia setelah disetujui.');var blob=DriveApp.getFileById(inv.pdfId).getBlob();return {name:inv.number.replace(/\//g,'-')+'.pdf',base64:Utilities.base64Encode(blob.getBytes())};
  } else throw Error('Aksi portal tidak dikenal.');
  try {portalPut_('Invoice',inv.id,inv);}catch(error){if(action==='review'&&inv.pdfId&&inv.status==='APPROVED'){try{DriveApp.getFileById(inv.pdfId).setTrashed(true);}catch(cleanup){}}throw error;}
  return inv;
 }finally{lock.releaseLock();}
}
function portalDetailLines_(data) {
 var d=normalizeRecord_(data).details,lines=[['Tanggal pengajuan',data.requestDate],['Jenis proyek',data.projectType],['Kategori',data.requestCategory],['Jenis pengajuan',data.requestType]];
 function period(value){return value.tanggal||value.mulai+' s/d '+value.selesai;}
 if(data.requestType==='Sales'){lines.push(['Periode pengajuan',period(d.periode)],['Jumlah sales',String(d.jumlahSales)],['Catatan',d.catatan]);}
 else if(data.requestType==='Manage Service')lines.push(['Periode penagihan',period(d.periodePenagihan)]);
 else if(data.requestType==='Reimburst')d.rincian.forEach(function(item,i){lines.push(['Rincian '+(i+1),item.objek+' — Rp '+item.nominal.toLocaleString('id-ID')]);});
 else {lines.push(['Tanggal pekerjaan',period(d.tanggal)]);if(data.requestCategory==='Projek')lines.push(['QTY/Jumlah',String(d.jumlah)+' '+d.satuan]);lines.push(['Keterangan',d.keterangan]);}
 return lines;
}
function portalEscape_(value){return String(value==null?'':value).replace(/[&<>"']/g,function(c){return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];});}
function portalCreatePdf_(inv){
 var e=portalEscape_,rupiah=function(n){return 'Rp '+Number(n).toLocaleString('id-ID');};
 var html='<html><head><meta charset="utf-8"><style>body{font:12px Arial;color:#183244;padding:30px}table{width:100%;border-collapse:collapse}td,th{padding:10px;border-bottom:1px solid #ddd;text-align:left}h1{color:#087f73}small{color:#666}</style></head><body><h1>INVOICE</h1><p>'+e(inv.number)+'</p><h3>Diterbitkan oleh: '+e(inv.profile.name)+'</h3><p>'+e(inv.profile.address)+'<br>'+e(inv.email)+'<br>'+e(inv.profile.phone)+'</p><h3>Ditagihkan kepada: PT Blue Connect Indonesia</h3><p>Jenis: '+e(inv.data.requestType)+' · '+e(inv.data.projectType)+'<br>Tanggal persetujuan: '+e(inv.approvedAt.slice(0,10))+'</p><h3>Detail pekerjaan</h3><pre>'+portalDetailLines_(inv.data).map(function(line){return '<strong>'+e(line[0])+':</strong> '+e(line[1]);}).join('<br>')+'</pre><table><tr><th>Rincian</th><th>Jumlah</th><th>Satuan</th><th>Harga</th><th>Total</th></tr>'+inv.items.map(function(i){return '<tr><td>'+e(i.description)+'</td><td>'+e(i.qty)+'</td><td>'+e(i.unit)+'</td><td>'+e(rupiah(i.price))+'</td><td>'+e(rupiah(i.amount))+'</td></tr>';}).join('')+'</table><h2>Total '+e(rupiah(inv.total))+'</h2><p>Pembayaran ke '+e(inv.profile.bank)+'<br>Nomor rekening: '+e(inv.profile.accountNumber)+'<br>Atas nama: '+e(inv.profile.accountOwner)+'</p><small>Disetujui oleh '+e(inv.approvedBy)+'. Nilai sesuai persetujuan aplikasi; tidak mencakup perhitungan pajak/potongan otomatis.</small></body></html>';
 var blob=HtmlService.createHtmlOutput(html).getAs('application/pdf').setName(inv.number.replace(/\//g,'-')+'.pdf');
 var root=DriveApp.getFolderById(PropertiesService.getScriptProperties().getProperty('UPLOAD_FOLDER_ID')||EVIDENCE_DEFAULT_FOLDER_ID_),folders=root.getFoldersByName('Invoice Disetujui'),target=folders.hasNext()?folders.next():root.createFolder('Invoice Disetujui');return target.createFile(blob);
}
