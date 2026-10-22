/** All UI text, Amharic first. `en` must have exactly the same keys (enforced by the type). */

const am = {
  langCode: 'am' as string,
  appName: 'መዝገብ',
  loading: 'መዝገብ እየተጀመረ ነው…',
  cantConnect: 'ወደ ሰርቨር ማገናኘት አልተቻለም',
  noConnection: 'ኢንተርኔት ወይም ሰርቨሩ አይገኝም። ግንኙነቱን አረጋግጠው እንደገና ይሞክሩ።',
  tryAgain: 'እንደገና ሞክር',

  // navigation
  dashboard: 'ዋና ገጽ', sales: 'ሽያጭ', purchases: 'ግዢ', payments: 'ክፍያዎች', customers: 'ደንበኞች',
  suppliers: 'አቅራቢዎች', inventory: 'እቃ ክምችት', production: 'ምርት', expenses: 'ወጪዎች', reports: 'ሪፖርቶች',
  settings: 'ቅንብሮች', more: 'ተጨማሪ',

  // common
  save: 'አስቀምጥ', cancel: 'ሰርዝ', close: 'ዝጋ', edit: 'አስተካክል', remove: 'አስወግድ',
  search: 'ፈልግ', saving: 'እየተቀመጠ…', call: 'ደውል', print: 'አትም', all: 'ሁሉም', fixErrors: 'እባክዎ ያስተካክሉ፦',
  paid: 'ተከፍሏል', partial: 'ከፊል', unpaid: 'ያልተከፈለ',

  // page headers
  hello: 'ሰላም!', helloSub: 'የንግድዎን ዛሬ እንቅስቃሴ በአንድ ቦታ ይከታተሉ።',
  salesSub: 'የደንበኞችን ሽያጭ፣ ክፍያ እና ቀሪ ሂሳብ ይከታተሉ።', purchasesSub: 'የጥሬ እቃ ግዢዎችን እና የአቅራቢ ዕዳን ይቆጣጠሩ።',
  paymentsSub: 'እያንዳንዱ ክፍያ ከዋናው ሽያጭ/ግዢ ተለይቶ ይመዝገባል።', peopleSub: 'የሂሳብ መግለጫ እና የክፍያ ታሪክ',
  inventorySub: 'ጥሬ እቃ እና የተዘጋጁ ኮኖችን በተለየ ምድብ ይከታተሉ።', productionSub: 'ክብደቱ እንዲመጣጠን ውጤት + ብክነት = ጥሬ እቃ መሆኑን ያረጋግጡ።',
  expensesSub: 'የንግድ ወጪዎችን ከክፍያ ግብይቶች ተለይተው ይመዝግቡ።', reportsSub: 'የተመረጠው ጊዜ ማጠቃለያ', settingsSub: 'የመዝገቡን ምርጫዎች ያስተካክሉ።',

  // dashboard
  newSale: 'አዲስ ሽያጭ', newPurchase: 'አዲስ ግዢ', newPayment: 'ክፍያ መዝግብ', newExpense: 'አዲስ ወጪ', newProduction: 'ምርት መዝግብ',
  customersOwe: 'የደንበኛ ዕዳ', youOwe: 'የአቅራቢ ዕዳ', stockValue: 'የክምችት ዋጋ',
  recentSales: 'የቅርብ ጊዜ ሽያጮች', unpaidInvoices: 'ያልተከፈሉ ሂሳቦች', nothingHere: 'ምንም መረጃ የለም።',

  // filters
  filters: 'ማጣሪያ', clearFilters: 'አጽዳ', date: 'ቀን', today: 'ዛሬ', last7: '7 ቀን', last30: '30 ቀን', anyDate: 'ሁሉም ቀን',
  pickDates: 'ቀን ምረጥ', from: 'ከ', to: 'እስከ', status: 'ሁኔታ', type: 'አይነት', category: 'ምድብ', person: 'ሰው',
  found: 'ተገኝቷል', total: 'ጠቅላላ', remaining: 'ቀሪ', owesMoney: 'ዕዳ ያለባቸው',

  // sale / purchase
  customer: 'ደንበኛ', supplier: 'አቅራቢ',
  saleItems: 'የሚሸጡ ኮኖች', purchaseItems: 'የሚገዙ እቃዎች', product: 'እቃ', quantity: 'ብዛት', unitPrice: 'ዋጋ',
  addItem: 'እቃ ጨምር', discount: 'ቅናሽ (ብር)', amountPaid: 'የተከፈለ (ብር)', paidInFull: 'ሙሉ ተከፍሏል', note: 'ማስታወሻ',
  saleDate: 'የሽያጭ ቀን', purchaseDate: 'የግዢ ቀን', paymentDate: 'የክፍያ ቀን',
  noCustomers: 'ደንበኛ ገና አልተመዘገበም።', noSuppliers: 'አቅራቢ ገና አልተመዘገበም።',
  errPerson: 'ደንበኛ/አቅራቢ ይምረጡ', errItems: 'ቢያንስ አንድ እቃ ከብዛቱ ጋር ያስገቡ', errOverpaid: 'የተከፈለው ከጠቅላላው በላይ ሆኗል',
  errAmount: 'መጠን ያስገቡ', errName: 'ስም ያስገቡ', errDescription: 'መግለጫ ያስገቡ',
  errRaw: 'ጥሬ እቃ ይምረጡ', errOutputs: 'የተመረቱ ኮኖችን ያስገቡ', errRawKg: 'የተጠቀሙትን ኪሎ ያስገቡ', errNotEnough: 'ያለው ጥሬ እቃ በቂ አይደለም',
  saleSaved: 'ሽያጩ ተመዝግቧል', purchaseSaved: 'ግዢው ተመዝግቧል',
  noSellable: 'የሚሸጥ እቃ ገና አልተመዘገበም። በ"ቅንብሮች" ገጽ ላይ ይጨምሩ።', noBuyable: 'የሚገዛ እቃ ገና አልተመዘገበም። በ"ቅንብሮች" ገጽ ላይ ይጨምሩ።',
  goSettings: 'ወደ ቅንብሮች',

  // payments
  paymentKind: 'ክፍያ አይነት', received: 'ከደንበኛ የተቀበልኩት', paidOut: 'ለአቅራቢ የከፈልኩት', amount: 'መጠን (ብር)',
  payFullBalance: 'ሙሉ ዕዳው', balance: 'ቀሪ ዕዳ', paymentNote: 'ክፍያው ለቆዩት ያልተከፈሉ ሂሳቦች በቅደም ተከተል ይመደባል።',
  paymentSaved: 'ክፍያው ተመዝግቧል', moneyIn: 'የገባ', moneyOut: 'የወጣ',

  // people
  name: 'ስም', phone: 'ስልክ', address: 'አድራሻ', addCustomer: 'ደንበኛ መዝግብ', addSupplier: 'አቅራቢ መዝግብ',
  editCustomer: 'ደንበኛ አስተካክል', editSupplier: 'አቅራቢ አስተካክል', owes: 'ቀሪ ዕዳ', personSaved: 'ተመዝግቧል',

  // inventory
  manageProducts: 'እቃዎችን አስተዳድር',
  productName: 'የእቃው ስም', productNameEn: 'ስም በእንግሊዝኛ',
  canBuy: 'ይገዛል',
  stockNow: 'ያለው ብዛት',
  reorder: 'ዝቅተኛ ብዛት (ማስጠንቀቂያ)', productSaved: 'እቃው ተመዝግቧል', lowBadge: 'ሊያልቅ ነው',

  // production
  rawCone: 'ጥሬ እቃ', rawKgUsed: 'የተጠቀሙት ጥሬ እቃ (ኪ.ግ)', outputs: 'የተመረቱ ኮኖች',
  waste: 'ብክነት', productionSaved: 'ምርቱ ተመዝግቧል', noRaw: 'ጥሬ እቃ ገና አልተመዘገበም።',
  noFinished: 'የተዘጋጀ እቃ ገና አልተመዘገበም።',

  // expenses
  description: 'መግለጫ', expenseSaved: 'ወጪው ተመዝግቧል',
  cat_transport: 'መጓጓዣ', cat_utility: 'መብራት / ውሃ', cat_rent: 'ኪራይ', cat_salary: 'ደመወዝ', cat_food: 'ምግብ', cat_other: 'ሌላ',

  // reports / settings
  salesTotal: 'ሽያጭ', purchasesTotal: 'ግዢ', expensesTotal: 'ወጪ', rightNow: 'አሁን ያለው ሁኔታ',
  language: 'ቋንቋ', signOut: 'ውጣ', signOutHint: 'በዚህ መሣሪያ ላይ ከመዝገብ ውጣ', itemsCol: 'እቃዎች',

  // products (identity + raw / finished forms)
  productsTitle: 'ምርቶች', productsHint: 'እያንዳንዱ ምርት አንድ ስም አለው። ጥሬ ኮኑ በኪሎ፣ የተዘጋጀው ምርት በቱባ ይቆጠራል።',
  addProductItem: 'ምርት ጨምር', editItem: 'ምርት አስተካክል',
  rawForm: 'ጥሬ ኮን (በኪሎ)', rawFormHint: 'በኪሎ ይገዛል፣ ለምርት ይውላል', finishedForm: 'የተዘጋጀ ምርት (በቱባ)',
  finishedFormHint: 'በማዳበሪያ / ፓኬት / ፍሬ ይሸጣል', pricePerBase: 'ዋጋ በ1 {u} (ብር)',
  alsoBuyFinished: 'የተዘጋጀውንም በቀጥታ እንገዛለን', active: 'ንቁ', inactive: 'የተቋረጠ', errNoForm: 'ጥሬ ኮን ወይም የተዘጋጀ ምርት ይምረጡ',

  // packaging
  saved: 'ተቀምጧል', packagingTitle: 'የማሸጊያ መለኪያዎች', packagingHint: 'ሁሉም በቱባ ይገለጻሉ። ለውጥ በአዲስ ግብይቶች ላይ ብቻ ይሠራል፤ ያለፉት ሽያጮች አይቀየሩም።',
  addPackaging: 'መለኪያ ጨምር', editPackaging: 'መለኪያ አስተካክል', unitType: 'መለኪያ', labelAm: 'ስም (አማርኛ)', labelEn: 'ስም (እንግሊዝኛ)',
  basePerUnit: '1 {u} = ስንት {b}?', pricePerUnit: 'ዋጋ በ1 {u} (ብር)', priceNotSet: 'ዋጋ አልተወሰነም', defaultUnit: 'ዋና የመሸጫ መለኪያ',
  errFactor: 'ቁጥሩ ከ0 በላይ መሆን አለበት', noFinishedItems: 'መጀመሪያ የተዘጋጀ ምርት ይመዝገቡ',
  unit_MADABERIYA_TIDOSH: 'ማዳበሪያ / ትዶሽ', unit_PACKET: 'ፓኬት', unit_PIECE: 'ፍሬ',

  // sale / production with units
  goesNegative: 'ክምችቱ ከዜሮ በታች ይሆናል — ያልተመዘገበ ግዢ/ምርት ካለ በኋላ ያስገቡ',
  sellUnit: 'መለኪያ', deducts: 'ከክምችት የሚቀነስ', available: 'ያለው', errPrice: 'የመሸጫ ዋጋ ያስገቡ', addOutput: 'ውጤት ጨምር',
  wasteKg: 'ብክነት (ኪ.ግ) — ካለ', producedAs: 'የተመረተው',

  // inventory
  rawSection: 'ጥሬ ኮን (ኪ.ግ)', finishedSection: 'የተዘጋጁ ምርቶች (ቱባ)',
  derivedNote: 'ከቱባው የተሰሉ ግምቶች ናቸው እንጂ የተለየ ክምችት አይደሉም።',

  // details, edit, delete
  saleDetail: 'የሽያጭ ዝርዝር', purchaseDetail: 'የግዢ ዝርዝር', paymentDetail: 'የክፍያ ዝርዝር', productionDetail: 'የምርት ዝርዝር',
  expenseDetail: 'የወጪ ዝርዝር', editSale: 'ሽያጭ አስተካክል', editPurchase: 'ግዢ አስተካክል', editPayment: 'ክፍያ አስተካክል',
  editExpense: 'ወጪ አስተካክል', editProduction: 'ምርት አስተካክል',
  paymentsSeparate: 'የተከፈሉ ክፍያዎች እንዳሉ ይቆያሉ፤ ክፍያ ለመጨመር ወይም ለማስተካከል ከዝርዝሩ "ክፍያ መዝግብ" ይጠቀሙ።',
  delete: 'ሰርዝ', confirmDelete: 'በእርግጥ ይሰረዝ? ይህ ሊመለስ አይችልም።', yesDelete: 'አዎ፣ ሰርዝ', deleted: 'ተሰርዟል',
  deleteSaleWarning: 'ለዚህ ሽያጭ ብቻ የተደረጉ ክፍያዎችም አብረው ይሰረዛሉ። ክምችቱ ይመለሳል።',
  deletePurchaseWarning: 'ለዚህ ግዢ ብቻ የተደረጉ ክፍያዎችም አብረው ይሰረዛሉ። የተገዛው ክምችት ይቀነሳል።',
  deleteProductionWarning: 'ጥሬ ኮኑ ይመለሳል፤ የተመረተው ከክምችት ይቀነሳል።',
  paymentsApplied: 'የተከፈሉ ክፍያዎች', noPayments: 'ምንም ክፍያ የለም።', appliedTo: 'ለየትኛው ሂሳብ እንደዋለ',
  unallocated: 'ያልተመደበ', unallocatedHint: 'ከዕዳው በላይ የተከፈለ (ቅድሚያ ክፍያ)',
  totalSold: 'ጠቅላላ የተሸጠ', totalBought: 'ጠቅላላ የተገዛ', totalPaid: 'ጠቅላላ የተከፈለ', credit: 'ቅድሚያ የተከፈለ',
  movements: 'የክምችት እንቅስቃሴ', reason_purchase: 'ግዢ', reason_sale: 'ሽያጭ', reason_production_in: 'ምርት (ገባ)',
  reason_production_out: 'ምርት (ወጣ)', reason_adjustment: 'ማስተካከያ',
  thisMonth: 'ይህ ወር', monthSales: 'የ{m} ሽያጭ', lastMonth: 'ያለፈው ወር ({m})', allTime: 'ከመጀመሪያ ጀምሮ',
  byProduct: 'በምርት', allSales: 'ሁሉንም ሽያጮች እይ', customersWhoOwe: 'ዕዳ ያለባቸው ደንበኞች', suppliersWeOwe: 'ዕዳ ያለብን አቅራቢዎች',
  stockValueNote: 'ጥሬ ኮን በመግዣ ዋጋ (ካልተወሰነ በመጨረሻው ግዢ ዋጋ)፣ የተዘጋጀ ምርት በመሸጫ ዋጋ (ካልተወሰነ በመጨረሻው ሽያጭ ዋጋ) ይሰላል። ከዜሮ በታች ያለ ክምችት አይቆጠርም።',

  // API error codes
  err_IN_USE: 'ታሪክ ስላለው መሰረዝ አይቻልም (ምርትን "የተቋረጠ" ማድረግ ይቻላል)', err_INVALID_PURCHASE_ITEM: 'ትክክለኛ እቃ ይምረጡ',
  err_INSUFFICIENT_STOCK: 'ክምችቱ በቂ አይደለም', err_DUPLICATE_UNIT: 'ይህ መለኪያ ለዚህ ምርት አስቀድሞ አለ',
  err_DUPLICATE_CODE: 'ይህ ኮድ ለሌላ ምርት ተይዟል', err_INVALID_SALE_ITEM: 'የተዘጋጀ ምርት እና ትክክለኛ መለኪያ ይምረጡ',
  err_RAW_MATERIAL_REQUIRED: 'ጥሬ ኮን ይምረጡ', err_INVALID_OUTPUT: 'ውጤቱ የተዘጋጀ ምርት እና ትክክለኛ መለኪያ መሆን አለበት',
  err_INVALID_FACTOR: 'ቁጥሩ ከ0 በላይ መሆን አለበት', err_NOT_A_FINISHED_PRODUCT: 'መለኪያ የሚሰጠው ለተዘጋጀ ምርት ብቻ ነው',
  err_DUPLICATE_FORM: 'ይህ ክፍል አስቀድሞ አለ',
}

export type T = typeof am

const en: T = {
  langCode: 'en',
  appName: 'Mezgeb',
  loading: 'Starting Mezgeb…',
  cantConnect: 'Could not connect to the server',
  noConnection: 'No internet or the server is unreachable. Check the connection and try again.',
  tryAgain: 'Try again',

  dashboard: 'Dashboard', sales: 'Sales', purchases: 'Purchases', payments: 'Payments', customers: 'Customers',
  suppliers: 'Suppliers', inventory: 'Inventory', production: 'Production', expenses: 'Expenses', reports: 'Reports',
  settings: 'Settings', more: 'More',

  save: 'Save', cancel: 'Cancel', close: 'Close', edit: 'Edit', remove: 'Remove',
  search: 'Search', saving: 'Saving…', call: 'Call', print: 'Print', all: 'All', fixErrors: 'Please fix:',
  paid: 'Paid', partial: 'Partial', unpaid: 'Unpaid',

  hello: 'Hello!', helloSub: "Follow today's business activity in one place.",
  salesSub: 'Track customer sales, payments and balances.', purchasesSub: 'Manage raw material purchases and supplier debt.',
  paymentsSub: 'Each payment is recorded separately from its sale/purchase.', peopleSub: 'Statements and payment history',
  inventorySub: 'Track raw material and finished cones separately.', productionSub: 'Check that output + waste = raw material.',
  expensesSub: 'Record business expenses separately from payments.', reportsSub: 'Summary for the chosen period', settingsSub: 'Adjust ledger preferences.',

  newSale: 'New sale', newPurchase: 'New purchase', newPayment: 'Record payment', newExpense: 'New expense', newProduction: 'Record production',
  customersOwe: 'Customer debt', youOwe: 'Supplier debt', stockValue: 'Stock value',
  recentSales: 'Recent sales', unpaidInvoices: 'Unpaid invoices', nothingHere: 'No data.',

  filters: 'Filter', clearFilters: 'Clear', date: 'Date', today: 'Today', last7: '7 days', last30: '30 days', anyDate: 'Any date',
  pickDates: 'Pick dates', from: 'From', to: 'To', status: 'Status', type: 'Type', category: 'Category', person: 'Person',
  found: 'found', total: 'Total', remaining: 'Remaining', owesMoney: 'Owe money',

  customer: 'Customer', supplier: 'Supplier',
  saleItems: 'Items sold', purchaseItems: 'Items bought', product: 'Product', quantity: 'Qty', unitPrice: 'Price',
  addItem: 'Add item', discount: 'Discount (ETB)', amountPaid: 'Paid (ETB)', paidInFull: 'Paid in full', note: 'Note',
  saleDate: 'Sale date', purchaseDate: 'Purchase date', paymentDate: 'Payment date',
  noCustomers: 'No customers yet.', noSuppliers: 'No suppliers yet.',
  errPerson: 'Choose a customer/supplier', errItems: 'Enter at least one item with a quantity', errOverpaid: 'Paid is more than the total',
  errAmount: 'Enter an amount', errName: 'Enter a name', errDescription: 'Enter a description',
  errRaw: 'Choose the raw material', errOutputs: 'Enter the cones produced', errRawKg: 'Enter the kg used', errNotEnough: 'Not enough raw material in stock',
  saleSaved: 'Sale saved', purchaseSaved: 'Purchase saved',
  noSellable: 'No sellable products yet. Add them on the "Settings" page.', noBuyable: 'No purchasable products yet. Add them on the "Settings" page.',
  goSettings: 'Go to Settings',

  paymentKind: 'Payment type', received: 'Received from customer', paidOut: 'Paid to supplier', amount: 'Amount (ETB)',
  payFullBalance: 'Full balance', balance: 'Balance', paymentNote: 'The payment is applied to the oldest unpaid bills first.',
  paymentSaved: 'Payment saved', moneyIn: 'In', moneyOut: 'Out',

  name: 'Name', phone: 'Phone', address: 'Address', addCustomer: 'Add customer', addSupplier: 'Add supplier',
  editCustomer: 'Edit customer', editSupplier: 'Edit supplier', owes: 'Balance', personSaved: 'Saved',

  manageProducts: 'Manage products',
  productName: 'Product name', productNameEn: 'Name in English',
  canBuy: 'Buy',
  stockNow: 'In stock',
  reorder: 'Low-stock level', productSaved: 'Product saved', lowBadge: 'Low',

  rawCone: 'Raw material', rawKgUsed: 'Raw material used (kg)', outputs: 'Cones produced',
  waste: 'Waste', productionSaved: 'Production saved', noRaw: 'No raw material yet.',
  noFinished: 'No finished products yet.',

  description: 'Description', expenseSaved: 'Expense saved',
  cat_transport: 'Transport', cat_utility: 'Electricity / water', cat_rent: 'Rent', cat_salary: 'Salary', cat_food: 'Food', cat_other: 'Other',

  salesTotal: 'Sales', purchasesTotal: 'Purchases', expensesTotal: 'Expenses', rightNow: 'Right now',
  language: 'Language', signOut: 'Sign out', signOutHint: 'Sign out of Mezgeb on this device', itemsCol: 'Items',

  productsTitle: 'Products', productsHint: 'Each product has one name. Its raw cone is counted in kg, the finished product in TUBA.',
  addProductItem: 'Add product', editItem: 'Edit product',
  rawForm: 'Raw cone (kg)', rawFormHint: 'Bought by the kg, used in production', finishedForm: 'Finished product (TUBA)',
  finishedFormHint: 'Sold by Madaberiya / packet / piece', pricePerBase: 'Price per 1 {u} (ETB)',
  alsoBuyFinished: 'We also buy the finished product directly', active: 'Active', inactive: 'Inactive', errNoForm: 'Choose raw cone or finished product',

  saved: 'Saved', packagingTitle: 'Packaging units', packagingHint: 'All expressed in TUBA. Changes apply to new transactions only; past sales are not changed.',
  addPackaging: 'Add unit', editPackaging: 'Edit unit', unitType: 'Unit', labelAm: 'Name (Amharic)', labelEn: 'Name (English)',
  basePerUnit: '1 {u} = how many {b}?', pricePerUnit: 'Price per 1 {u} (ETB)', priceNotSet: 'No price set', defaultUnit: 'Default selling unit',
  errFactor: 'Must be greater than 0', noFinishedItems: 'Add a finished product first',
  unit_MADABERIYA_TIDOSH: 'Madaberiya / Tidosh', unit_PACKET: 'Packet', unit_PIECE: 'Piece',

  goesNegative: 'stock will go below zero — record the missing purchase/production later',
  sellUnit: 'Unit', deducts: 'Taken from stock', available: 'Available', errPrice: 'Enter the selling price', addOutput: 'Add output',
  wasteKg: 'Waste (kg) — optional', producedAs: 'Produced',

  rawSection: 'Raw cone (kg)', finishedSection: 'Finished products (TUBA)',
  derivedNote: 'Equivalents are calculated from TUBA; they are not separate stock.',

  saleDetail: 'Sale details', purchaseDetail: 'Purchase details', paymentDetail: 'Payment details', productionDetail: 'Production details',
  expenseDetail: 'Expense details', editSale: 'Edit sale', editPurchase: 'Edit purchase', editPayment: 'Edit payment',
  editExpense: 'Edit expense', editProduction: 'Edit production',
  paymentsSeparate: 'Recorded payments stay as they are; use "Record payment" in the details to add or change payments.',
  delete: 'Delete', confirmDelete: 'Delete this? This cannot be undone.', yesDelete: 'Yes, delete', deleted: 'Deleted',
  deleteSaleWarning: 'Payments made only for this sale are deleted too. The stock is put back.',
  deletePurchaseWarning: 'Payments made only for this purchase are deleted too. The bought stock is taken out.',
  deleteProductionWarning: 'The raw cone goes back; the produced output is taken out of stock.',
  paymentsApplied: 'Payments', noPayments: 'No payments.', appliedTo: 'Applied to',
  unallocated: 'Not applied', unallocatedHint: 'Paid beyond what was owed (credit)',
  totalSold: 'Total sold', totalBought: 'Total bought', totalPaid: 'Total paid', credit: 'Credit',
  movements: 'Stock movements', reason_purchase: 'Purchase', reason_sale: 'Sale', reason_production_in: 'Production (in)',
  reason_production_out: 'Production (out)', reason_adjustment: 'Adjustment',
  thisMonth: 'This month', monthSales: '{m} sales', lastMonth: 'Last month ({m})', allTime: 'All time',
  byProduct: 'By product', allSales: 'See all sales', customersWhoOwe: 'Customers who owe', suppliersWeOwe: 'Suppliers we owe',
  stockValueNote: 'Raw cone is valued at its buying price (or the latest purchase price), finished products at their selling price (or the latest sale price). Stock below zero counts as nothing.',

  err_IN_USE: 'Has history, so it can’t be deleted (a product can be made inactive instead)', err_INVALID_PURCHASE_ITEM: 'Choose a valid product',
  err_INSUFFICIENT_STOCK: 'Not enough stock', err_DUPLICATE_UNIT: 'This product already has that unit',
  err_DUPLICATE_CODE: 'That code is used by another product', err_INVALID_SALE_ITEM: 'Choose a finished product and a valid unit',
  err_RAW_MATERIAL_REQUIRED: 'Choose a raw cone', err_INVALID_OUTPUT: 'Output must be a finished product with a valid unit',
  err_INVALID_FACTOR: 'Must be greater than 0', err_NOT_A_FINISHED_PRODUCT: 'Packaging units are only for finished products',
  err_DUPLICATE_FORM: 'That form already exists',
}

export const dictionaries = { am, en }
export type Lang = keyof typeof dictionaries

export const expenseCategories = ['transport', 'utility', 'rent', 'salary', 'food', 'other'] as const
export const categoryLabel = (t: T, c: string) => (t as any)[`cat_${c}`] ?? c

/** A packaging unit's label in the current language. */
export const unitLabel = (t: T, u: { label_am: string; label_en: string }) => (t.langCode === 'en' ? u.label_en : u.label_am)

/** Fill {u} / {b} placeholders, e.g. fmt(t.pricePerUnit, { u: 'ፓኬት' }). */
export const fmt = (s: string, vars: Record<string, string>) => s.replace(/\{(\w+)\}/g, (_, k) => vars[k] ?? '')

/** Translate API error codes (INSUFFICIENT_STOCK, …); other messages pass through. */
export const errorText = (t: T, message: string) => (t as any)[`err_${message}`] ?? message
