const XLSX = require('xlsx');

const file = 'uploads/boq/4d7f17e0-74c9-424b-8e82-f21ff2fc408f/boq-1771671763339-400846915.csv';
const column_mapping = {"qty": "Quantity", "uom": "Unit", "item": "Description"};

try {
  const workbook = XLSX.readFile(file);
  const sheetName = workbook.SheetNames[0];
  const worksheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(worksheet, { header: 1 });
  
  const headers = data[0].map(h => String(h).trim());
  const rows = data.slice(1).filter(row => row.some(cell => cell));
  
  console.log('Headers:', headers);
  
  const mapping = column_mapping ? column_mapping : {};
  const itemCol = mapping.item || headers.find(h => /item|description|name/i.test(h)) || headers[0];
  const qtyCol = mapping.qty || headers.find(h => /qty|quantity/i.test(h)) || headers[1];
  const uomCol = mapping.uom || headers.find(h => /uom|unit/i.test(h)) || headers[2];
  
  console.log('Mapped columns - item:', itemCol, 'qty:', qtyCol, 'uom:', uomCol);
  
  const itemIdx = headers.indexOf(itemCol);
  const qtyIdx = headers.indexOf(qtyCol);
  const uomIdx = headers.indexOf(uomCol);
  
  console.log('Column indices - item:', itemIdx, 'qty:', qtyIdx, 'uom:', uomIdx);
  
  const items = rows.map((row, index) => {
    const item = itemIdx >= 0 ? String(row[itemIdx] || '').trim() : '';
    const qtyStr = qtyIdx >= 0 ? String(row[qtyIdx] || '0') : '0';
    const qty = parseFloat(qtyStr.replace(/[^0-9.]/g, '')) || 0;
    const uom = uomIdx >= 0 ? String(row[uomIdx] || '').trim() : '';
    
    return {
      id: index + 1,
      item,
      qty,
      uom,
      rate: 0,
      total: 0,
    };
  }).filter(item => item.item && item.qty > 0);
  
  console.log('Total items:', items.length);
  console.log('Items:', JSON.stringify(items, null, 2));
} catch (error) {
  console.error('Error:', error.message);
  console.error(error.stack);
}
