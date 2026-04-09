import pg from 'pg';
const { Pool } = pg;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function main() {
  // BTN - derive monthly rates
  const btn = await pool.query(`SELECT periodo, "coefEmReal" FROM pdf_historical_indexes WHERE "indiceTipo"='BTN' ORDER BY periodo`);
  console.log('=== BTN (' + btn.rows.length + ' records, monthly rates derived) ===');
  for (let i = 1; i < btn.rows.length; i++) {
    const cur = parseFloat(btn.rows[i].coefEmReal);
    const prev = parseFloat(btn.rows[i-1].coefEmReal);
    const rate = cur / prev - 1;
    console.log(`"${btn.rows[i].periodo}": ${rate.toFixed(8)}, // ${(rate*100).toFixed(4)}%`);
  }

  // INPC pre-Real
  const inpc = await pool.query(`SELECT periodo, "coefEmReal" FROM pdf_historical_indexes WHERE "indiceTipo"='INPC' ORDER BY periodo`);
  console.log('\n=== INPC pre-Real (' + inpc.rows.length + ' records) ===');
  for (let i = 1; i < inpc.rows.length; i++) {
    const cur = parseFloat(inpc.rows[i].coefEmReal);
    const prev = parseFloat(inpc.rows[i-1].coefEmReal);
    const rate = cur / prev - 1;
    console.log(`"${inpc.rows[i].periodo}": ${rate.toFixed(8)}, // ${(rate*100).toFixed(4)}%`);
  }

  // OTN - raw coefs and monthly rates
  const otn = await pool.query(`SELECT periodo, "coefEmReal" FROM pdf_historical_indexes WHERE "indiceTipo"='OTN' ORDER BY periodo`);
  console.log('\n=== OTN (' + otn.rows.length + ' records raw coefs) ===');
  for (const r of otn.rows) console.log(`"${r.periodo}": ${parseFloat(r.coefEmReal).toFixed(10)}`);
  console.log('\n=== OTN monthly rates ===');
  for (let i = 1; i < otn.rows.length; i++) {
    const cur = parseFloat(otn.rows[i].coefEmReal);
    const prev = parseFloat(otn.rows[i-1].coefEmReal);
    const rate = cur / prev - 1;
    console.log(`"${otn.rows[i].periodo}": ${rate.toFixed(8)}, // ${(rate*100).toFixed(4)}%`);
  }

  // UFIR all
  const ufir = await pool.query(`SELECT periodo, "coefEmReal" FROM pdf_historical_indexes WHERE "indiceTipo"='UFIR' ORDER BY periodo`);
  console.log('\n=== UFIR all (' + ufir.rows.length + ' records) ===');
  for (const r of ufir.rows) console.log(`"${r.periodo}": ${parseFloat(r.coefEmReal).toFixed(10)}`);

  // UFIR pre-BRL monthly rates (from CR3/CRR era)
  console.log('\n=== UFIR monthly rates (pre-BRL) ===');
  const preBrl = ufir.rows.filter(r => r.periodo < '1994-07');
  for (let i = 1; i < preBrl.length; i++) {
    const cur = parseFloat(preBrl[i].coefEmReal);
    const prev = parseFloat(preBrl[i-1].coefEmReal);
    const rate = cur / prev - 1;
    console.log(`"${preBrl[i].periodo}": ${rate.toFixed(8)}, // ${(rate*100).toFixed(4)}%`);
  }

  await pool.end();
}
main().catch(e => { console.error(e.message); process.exit(1); });
