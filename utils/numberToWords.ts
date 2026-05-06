
export function numberToWords(num: number): string {
    const a = ['', 'One ', 'Two ', 'Three ', 'Four ', 'Five ', 'Six ', 'Seven ', 'Eight ', 'Nine ', 'Ten ', 'Eleven ', 'Twelve ', 'Thirteen ', 'Fourteen ', 'Fifteen ', 'Sixteen ', 'Seventeen ', 'Eighteen ', 'Nineteen '];
    const b = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

    const n = ('000000000' + num.toFixed(0)).substr(-9);
    let str = '';
    
    // Crores
    const crores = parseInt(n.substr(0, 2));
    if (crores > 0) {
        str += (crores < 20 ? a[crores] : b[Math.floor(crores / 10)] + ' ' + a[crores % 10]) + 'Crore ';
    }
    
    // Lakhs
    const lakhs = parseInt(n.substr(2, 2));
    if (lakhs > 0) {
        str += (lakhs < 20 ? a[lakhs] : b[Math.floor(lakhs / 10)] + ' ' + a[lakhs % 10]) + 'Lakh ';
    }
    
    // Thousands
    const thousands = parseInt(n.substr(4, 2));
    if (thousands > 0) {
        str += (thousands < 20 ? a[thousands] : b[Math.floor(thousands / 10)] + ' ' + a[thousands % 10]) + 'Thousand ';
    }
    
    // Hundreds
    const hundreds = parseInt(n.substr(6, 1));
    if (hundreds > 0) {
        str += a[hundreds] + 'Hundred ';
    }
    
    // Tens and ones
    const tens = parseInt(n.substr(7, 2));
    if (tens > 0) {
        if (str !== '') str += 'and ';
        str += (tens < 20 ? a[tens] : b[Math.floor(tens / 10)] + ' ' + a[tens % 10]);
    }
    
    return str ? str + 'Only' : 'Zero Only';
}
