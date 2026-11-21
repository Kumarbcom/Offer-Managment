const fs = require('fs');
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient('https://jzdpbaornpkrgwwelvqa.supabase.co', 'sb_publishable_GeFTcwQrbVoqOz0huLdOaA_aghUoxzn');

// 1. Load clipboard master
const content = fs.readFileSync('clipboard_customers.tsv', 'utf8');
const lines = content.trim().split(/\r?\n/).slice(1);

function stripTag(str) {
  if (!str) return '';
  return str.replace(/\s*\([^\)]*\)\s*$/g, '').trim();
}

function cleanNorm(str) {
  if (!str) return '';
  return stripTag(str).toLowerCase().replace(/[^a-z0-9]/g, '');
}

function entityNorm(str) {
  if (!str) return '';
  return stripTag(str)
    .toLowerCase()
    .replace(/[\(\)\[\]\{\}\.,\-_'\"\/\\]/g, ' ')
    .replace(/\b(private|pvt|limited|ltd|llp|inc|corp|co|corporation|company|enterprises|enterprise|solutions|technologies|systems|india)\b/g, ' ')
    .replace(/\s+/g, '')
    .trim();
}

const mapExact = new Map();
const mapClean = new Map();
const mapEntity = new Map();

lines.forEach(l => {
  const [name, grp, rep] = l.split('\t');
  if (!name) return;

  let spId = 2; // Default Office
  if (rep === 'Giridhar') spId = 3;
  else if (rep === 'Veeresh') spId = 4;
  else if (rep === 'Ananth') spId = 1; // N Vinay Kumar
  else if (rep === 'Office' || rep === 'Online') spId = 2;

  const item = { name, grp, rep, spId };
  const en = name.toLowerCase().replace(/[^a-z0-9]/g, '');
  const cn = cleanNorm(name);
  const ent = entityNorm(name);

  mapExact.set(en, item);
  if (cn) mapClean.set(cn, item);
  if (ent && ent.length >= 4) mapEntity.set(ent, item);
});

// Address Keywords
const GIRIDHAR_KEYWORDS = [
    'peenya', 'tumkur', 'tumakur', 'nelamangala', 'jalahalli',
    'yeshwanthpur', 'yeshwantpur', 'rajajinagar', 'rajaji nagar',
    'goraguntepalya', 'dasarahalli', 'hegganahalli', 'magadi road',
    'chikkabanavara', 't-begur', 'dobbaspet', 'dabaspet', 'sompura'
];

const VEERESH_KEYWORDS = [
    'electronic city', 'electronics city', 'ecity', 'e-city',
    'anekal', 'ramanagar', 'ramanagara', 'ramnagaram',
    'kanakapura', 'kanakpura', 'harohalli', 'jp nagar', 'j p nagar',
    'hosur road', 'hosur rd', 'bommasandra', 'jigani', 'attibele',
    'bannerghatta', 'bikasipura', 'chandapura', 'begur', 'bannerughatta',
    'sarjapur road', 'sarjapura', 'kumbalgodu', 'bidadi', 'channapatna', 'hosur'
];

const VINAY_KEYWORDS = [
    'whitefield', 'white field', 'whitefeild', 'malur', 'kolar',
    'kr puram', 'k.r. puram', 'k r puram', 'krishnarajapuram', 'krishnarajapura',
    'doddaballapur', 'doddaballapura', 'doddabalapur', 'hoskote', 'hosakote',
    'hoodi', 'hudi', 'mahadevapura', 'mahadevpura', 'kadugodi',
    'marathahalli', 'marathalli', 'kundalahalli', 'brookefield', 'brookfield',
    'gowribidanur', 'itpl', 'devanahalli', 'chintamani', 'sidlaghatta', 'chikballapur', 'chikkaballapur'
];

const NON_KARNATAKA_STATES = [
    'tamil nadu', 'tamilnadu', 'maharashtra', 'andhra pradesh', 'telangana',
    'kerala', 'gujarat', 'delhi', 'haryana', 'uttar pradesh', 'rajasthan',
    'west bengal', 'madhya pradesh', 'orissa', 'odisha', 'punjab',
    'chandigarh', 'bihar', 'jharkhand', 'uttarakhand', 'chhattisgarh', 'goa', 'assam'
];

const NON_KARNATAKA_CITIES = [
    'mumbai', 'pune', 'chennai', 'hyderabad', 'coimbatore',
    'noida', 'gurgaon', 'gurugram', 'faridabad', 'kolkata',
    'ahmedabad', 'vadodara', 'surat', 'jaipur', 'nagpur', 'nashik',
    'aurangabad', 'cochin', 'kochi', 'trivandrum', 'thiruvananthapuram',
    'calicut', 'kozhikode', 'vijayawada', 'visakhapatnam', 'vizag',
    'secunderabad', 'tirupati', 'salem', 'trichy', 'tiruchirappalli',
    'madurai', 'pondicherry', 'puducherry', 'mumbra', 'thane', 'navi mumbai',
    'bhiwandi', 'vapi', 'silvassa', 'kanpur', 'lucknow', 'ghaziabad', 'indore',
    'bhopal', 'ludhiana', 'amritsar', 'jalandhar', 'waluj'
];

function matchByAddress(address, city, pincode) {
    const fullText = `${address || ''} ${city || ''} ${pincode || ''}`.toLowerCase();
    const cleanPin = (pincode || '').trim();

    // 1. Giridhar (Peenya / Tumkur)
    for (const kw of GIRIDHAR_KEYWORDS) {
        if (fullText.includes(kw)) return { spId: 3, rep: 'Giridhar', reason: `Peenya/Tumkur keyword: ${kw}` };
    }

    // 2. Veeresh (ECity / Hosur / Ramanagar / Harohalli / JP Nagar / Anekal)
    for (const kw of VEERESH_KEYWORDS) {
        if (fullText.includes(kw)) return { spId: 4, rep: 'Veeresh', reason: `ECity/Hosur keyword: ${kw}` };
    }

    // 3. Vinay (Whitefield / Doddaballapur / Kolar / Malur / KR Puram)
    for (const kw of VINAY_KEYWORDS) {
        if (fullText.includes(kw)) return { spId: 1, rep: 'N Vinay Kumar', reason: `Whitefield/Kolar keyword: ${kw}` };
    }

    // 4. Office (Other state than Karnataka)
    for (const kw of NON_KARNATAKA_STATES) {
        if (fullText.includes(kw)) return { spId: 2, rep: 'Office', reason: `Out of Karnataka state: ${kw}` };
    }
    for (const kw of NON_KARNATAKA_CITIES) {
        if (fullText.includes(kw)) return { spId: 2, rep: 'Office', reason: `Out of Karnataka city: ${kw}` };
    }

    // Out of Karnataka pincodes (Karnataka starts with 56, 57, 58, 59)
    if (/^\d{6}$/.test(cleanPin)) {
        const prefix = cleanPin.substring(0, 2);
        if (!['56', '57', '58', '59'].includes(prefix)) {
            return { spId: 2, rep: 'Office', reason: `Out of Karnataka pincode: ${cleanPin}` };
        }
    }

    return null;
}

async function execute() {
    console.log('Fetching all customers from Supabase...');
    let all = [];
    let from = 0;
    while(true) {
        const { data } = await supabase.from('customers').select('*').range(from, from + 999);
        if (!data || data.length === 0) break;
        all.push(...data);
        if (data.length < 1000) break;
        from += 1000;
    }
    console.log(`Fetched ${all.length} total customers.`);

    const spNames = { 1: 'N Vinay Kumar', 2: 'Office', 3: 'Giridhar', 4: 'Veeresh', 5: 'Need to update' };
    const toUpdate = [];

    const summary = {
        oneToOne: 0,
        address: 0,
        needToUpdate: 0,
        alreadyCorrect: 0,
        changesRequired: 0
    };

    all.forEach(c => {
        const en = c.name.toLowerCase().replace(/[^a-z0-9]/g, '');
        const cn = cleanNorm(c.name);
        const ent = entityNorm(c.name);

        let match = mapExact.get(en) || mapClean.get(cn) || (ent && ent.length >= 4 ? mapEntity.get(ent) : null);
        let finalSpId = 5;
        let matchType = '';
        let detail = '';

        if (match) {
            summary.oneToOne++;
            finalSpId = match.spId;
            matchType = '1-to-1 Match';
            detail = `${match.name} -> ${match.rep}`;
        } else {
            const addrMatch = matchByAddress(c.address, c.city, c.pincode);
            if (addrMatch) {
                summary.address++;
                finalSpId = addrMatch.spId;
                matchType = 'Address Match';
                detail = addrMatch.reason;
            } else {
                summary.needToUpdate++;
                finalSpId = 5;
                matchType = 'Need to update';
                detail = 'No match';
            }
        }

        if (c.sales_person_id !== finalSpId) {
            summary.changesRequired++;
            toUpdate.push({
                id: c.id,
                name: c.name,
                oldSpId: c.sales_person_id,
                newSpId: finalSpId,
                matchType,
                detail
            });
        } else {
            summary.alreadyCorrect++;
        }
    });

    console.log('\n=== EXECUTION PLAN ===');
    console.log(`Total Customers: ${all.length}`);
    console.log(`1-to-1 Matched: ${summary.oneToOne}`);
    console.log(`Address Matched: ${summary.address}`);
    console.log(`Need to update: ${summary.needToUpdate}`);
    console.log(`Already Correct in DB: ${summary.alreadyCorrect}`);
    console.log(`Customers to Update: ${summary.changesRequired}`);

    // Update in batches of 100
    const BATCH_SIZE = 100;
    console.log(`\nUpdating ${toUpdate.length} customers in Supabase in batches of ${BATCH_SIZE}...`);

    for (let i = 0; i < toUpdate.length; i += BATCH_SIZE) {
        const batch = toUpdate.slice(i, i + BATCH_SIZE);
        const promises = batch.map(u => 
            supabase.from('customers').update({ sales_person_id: u.newSpId }).eq('id', u.id)
        );
        const results = await Promise.all(promises);
        const hasError = results.some(r => r.error);
        if (hasError) {
            console.error(`Error in batch ${Math.floor(i / BATCH_SIZE) + 1}`);
        } else {
            process.stdout.write(`Batch ${Math.floor(i / BATCH_SIZE) + 1}/${Math.ceil(toUpdate.length / BATCH_SIZE)} complete. `);
        }
    }

    console.log('\nAll customer updates completed successfully in Supabase!');

    // Verify resulting counts in database
    console.log('\nVerifying resulting counts in Supabase...');
    const verifyList = [];
    from = 0;
    while(true) {
        const { data } = await supabase.from('customers').select('id, sales_person_id').range(from, from + 999);
        if (!data || data.length === 0) break;
        verifyList.push(...data);
        if (data.length < 1000) break;
        from += 1000;
    }

    const finalCounts = {};
    verifyList.forEach(c => {
        const spName = spNames[c.sales_person_id] || `Unknown (${c.sales_person_id})`;
        finalCounts[spName] = (finalCounts[spName] || 0) + 1;
    });

    console.log('\n=== FINAL CUSTOMER SALES PERSON DISTRIBUTION ===');
    console.log(finalCounts);
}

execute();
