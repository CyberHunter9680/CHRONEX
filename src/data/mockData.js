// CHRONEX Forensic Mock Database

export const initialCases = [
  {
    id: "CX-2026-0401",
    title: "Telegram VIP Crypto Investment Scam",
    description: "Victim was lured into a Telegram channel promising 300% daily returns on crypto trading. Transferred multiple tranches of funds via UPI to various mule accounts before being blocked.",
    status: "Under Investigation",
    priority: "Critical",
    createdAt: "2026-06-10T10:30:00Z",
    officer: "Inspector S. Sharma",
    classification: "Investment Scam",
    remarks: "Primary mule accounts identified. Request sent to bank for freeze. Link analysis indicates cross-case connection.",
    victim: {
      name: "Abhishek Verma",
      age: 29,
      phone: "+91 98765 43210",
      email: "abhishek.v@gmail.com",
      occupation: "Software Engineer",
      location: "Sector 62, Noida, UP"
    },
    notes: [
      { id: "n1", timestamp: "2026-06-10T11:00:00Z", officer: "Inspector S. Sharma", text: "Complaint registered. Victim submitted chat screenshots and transaction receipt PDFs." },
      { id: "n2", timestamp: "2026-06-11T14:22:00Z", officer: "Inspector S. Sharma", text: "Extracted UPI IDs matching known mule database. Initiated bank freeze request." }
    ],
    integrityHash: "3f8d2b7e9a0c1e5f8a9d0c2e3f4a5b6c7d8e9f0a1b2c3d4e5f6a7b8c9d0e1f2a"
  },
  {
    id: "CX-2026-0402",
    title: "Part-time Job Offer Telegram Fraud",
    description: "Victim received WhatsApp message offering simple YouTube video liking jobs. Initial small returns paid out, then coerced into depositing large sums under the guise of 'welfare tasks'.",
    status: "Open",
    priority: "High",
    createdAt: "2026-06-12T08:15:00Z",
    officer: "Sub-Inspector Priya Roy",
    classification: "Job Fraud",
    remarks: "WhatsApp business number is registered to a virtual SIM. Extracting telegram handle details.",
    victim: {
      name: "Meera Deshmukh",
      age: 34,
      phone: "+91 87654 32109",
      email: "meera.desh@yahoo.com",
      occupation: "Freelance Designer",
      location: "Andheri West, Mumbai, MH"
    },
    notes: [
      { id: "n3", timestamp: "2026-06-12T09:00:00Z", officer: "Sub-Inspector Priya Roy", text: "Case assigned. Initial review of WhatsApp chat exports shows referral to telegram user @taskmaster_vip." }
    ],
    integrityHash: "7b8c9d0e1f2a3f4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d"
  },
  {
    id: "CX-2026-0403",
    title: "Fake Loan App Harassment Case",
    description: "Victim downloaded 'QuickPaisa' loan app. Paid heavy interest, but app operators accessed contact list, photos, and are sending morphed images to relatives demanding more money.",
    status: "Under Investigation",
    priority: "Critical",
    createdAt: "2026-06-14T11:45:00Z",
    officer: "Inspector S. Sharma",
    classification: "Loan App Fraud",
    remarks: "IP addresses traced to hosting servers in Southeast Asia. APK reverse engineering in progress.",
    victim: {
      name: "Rahul Kumar",
      age: 24,
      phone: "+91 76543 21098",
      email: "rahulk24@outlook.com",
      occupation: "Student",
      location: "Rohini, New Delhi"
    },
    notes: [
      { id: "n4", timestamp: "2026-06-14T12:30:00Z", officer: "Inspector S. Sharma", text: "Victim's phone secured for forensic copy. Morphing threat messages verified from SMS and WhatsApp logs." }
    ],
    integrityHash: "9a0b1c2d3e4f5a6b7c8d9e0f1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b"
  },
  {
    id: "CX-2026-0404",
    title: "Sextortion Threat via Video Call",
    description: "Victim accepted a Facebook video call from a profile posing as a female. The call was recorded, victim's face morphed into an explicit video, and now being blackmailed for payments.",
    status: "Closed",
    priority: "Medium",
    createdAt: "2026-06-05T16:00:00Z",
    officer: "Sub-Inspector Priya Roy",
    classification: "Sextortion",
    remarks: "Suspect arrested in Bharatpur, Rajasthan. Accounts frozen, devices seized.",
    victim: {
      name: "Sanjay Patel",
      age: 42,
      phone: "+91 65432 10987",
      email: "spatel_ind@gmail.com",
      occupation: "Business Owner",
      location: "Ghatlodia, Ahmedabad, GJ"
    },
    notes: [
      { id: "n5", timestamp: "2026-06-05T17:15:00Z", officer: "Sub-Inspector Priya Roy", text: "Emergency complaints filed. Coordinated with Rajasthan Police Cyber Cell for location trace." },
      { id: "n6", timestamp: "2026-06-08T10:00:00Z", officer: "Sub-Inspector Priya Roy", text: "Suspect tracked, raided, and arrested. Device contains morphed clips of multiple victims. Initiating closing report." }
    ],
    integrityHash: "1a2b3c4d5e6f7a8b9c0d1e2f3a4b5c6d7e8f9a0b1c2d3e4f5a6b7c8d9e0f1a2b"
  }
];

export const initialEvidence = [
  {
    id: "E-101",
    caseId: "CX-2026-0401",
    fileName: "telegram_crypto_chat.png",
    fileType: "Telegram Chat",
    uploadedAt: "2026-06-10T10:45:00Z",
    uploadedBy: "Inspector S. Sharma",
    size: "824 KB",
    ocrLanguage: "English",
    ocrConfidence: 96,
    hash: "a4f89d9e48bc82d8c364e528d9f482d832c3f81e812d6a782bcfde321d234a56",
    tags: ["telegram", "crypto-scam", "suspect-contact"],
    ocrText: `[10:02] Crypto VIP Manager: Welcome! Start with only 10,000 INR and get 30,000 INR back in 2 hours. Guaranteed trading returns.
[10:05] Abhishek (Victim): Is it safe? I don't want to lose my savings.
[10:06] Crypto VIP Manager: 100% safe, government approved. Send money to our official UPI merchant ID: vip.invest@oksbi. 
[10:08] Crypto VIP Manager: Once paid, share screenshot here. Use transaction reference. Help number: +91 91234 56789.
[10:12] Abhishek (Victim): Sent 10,000 INR. Txn: UPI283948293849. Please credit.`,
    extractedEntities: {
      phones: ["+91 91234 56789"],
      upis: ["vip.invest@oksbi"],
      emails: [],
      urls: [],
      transactions: ["UPI283948293849"],
      accounts: [],
      ifscs: [],
      ips: [],
      amounts: ["10,000 INR", "30,000 INR"],
      dates: ["10:02", "10:05", "10:06", "10:08", "10:12"],
      usernames: ["@taskmaster_vip"]
    }
  },
  {
    id: "E-102",
    caseId: "CX-2026-0401",
    fileName: "upi_receipt_10k.png",
    fileType: "UPI Receipt",
    uploadedAt: "2026-06-10T10:48:00Z",
    uploadedBy: "Inspector S. Sharma",
    size: "412 KB",
    ocrLanguage: "English",
    ocrConfidence: 98,
    hash: "6e28d9f582c3e1e48bc8d9f4c3a2b1d6f78e9c0b1a23d45e6f78a9c0d1e2f3a4",
    tags: ["upi-receipt", "payment-proof"],
    ocrText: `STATE BANK OF INDIA
UPI Transaction Successful
Date: 10 June 2026, 10:12 AM
To: VIP CRYPTO ASSOCIATES
UPI ID: vip.invest@oksbi
From: ABHISHEK VERMA (xxxxxx3210)
Transaction ID: UPI283948293849
Ref No: 616293849283
IFSC: SBIN0001234
Amount: ₹10,000.00`,
    extractedEntities: {
      phones: [],
      upis: ["vip.invest@oksbi"],
      emails: [],
      urls: [],
      transactions: ["UPI283948293849", "616293849283"],
      accounts: ["xxxxxx3210"],
      ifscs: ["SBIN0001234"],
      ips: [],
      amounts: ["10,000.00"],
      dates: ["10 June 2026, 10:12 AM"],
      usernames: []
    }
  },
  {
    id: "E-103",
    caseId: "CX-2026-0402",
    fileName: "whatsapp_job_scam.png",
    fileType: "WhatsApp Chat",
    uploadedAt: "2026-06-12T08:30:00Z",
    uploadedBy: "Sub-Inspector Priya Roy",
    size: "680 KB",
    ocrLanguage: "English/Hindi",
    ocrConfidence: 91,
    hash: "28e9d8f72c3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f",
    tags: ["whatsapp", "job-fraud", "suspect-whatsapp"],
    ocrText: `[08:02 AM] +91 98989 89898: Hello, I am HR Representative from Global Media Agency. We offer part-time work.
[08:03 AM] +91 98989 89898: Task is very simple: Like YouTube video and send screenshot. Daily pay is 2000-5000 INR.
[08:05 AM] Meera (Victim): Yes, I am interested in this part time job. What do I do?
[08:06 AM] +91 98989 89898: Please join our Telegram group to claim bonus: https://t.me/global_media_tasks. Contact administrator @taskmaster_vip.
[08:09 AM] +91 98989 89898: To start first task, pay registration fee 500 INR to UPI: securepay.mule@okaxis.`,
    extractedEntities: {
      phones: ["+91 98989 89898"],
      upis: ["securepay.mule@okaxis"],
      emails: [],
      urls: ["https://t.me/global_media_tasks"],
      transactions: [],
      accounts: [],
      ifscs: [],
      ips: [],
      amounts: ["2000-5000 INR", "500 INR"],
      dates: ["08:02 AM", "08:03 AM", "08:05 AM", "08:06 AM", "08:09 AM"],
      usernames: ["@taskmaster_vip"]
    }
  },
  {
    id: "E-104",
    caseId: "CX-2026-0403",
    fileName: "loan_app_screenshot.png",
    fileType: "Social Media Screenshot",
    uploadedAt: "2026-06-14T12:00:00Z",
    uploadedBy: "Inspector S. Sharma",
    size: "1.1 MB",
    ocrLanguage: "English",
    ocrConfidence: 93,
    hash: "3d4e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e",
    tags: ["loan-app", "harassment", "apk-link"],
    ocrText: `QuickPaisa - Easy Loan Approval
Congratulations! Your loan of ₹5,000 has been disbursed to account 918273645029.
IFSC: UTIB0000999.
Repayment due in 7 days: ₹8,500.
Overdue charge: ₹500/day.
App downloaded from server: 104.244.42.1
If you fail to repay, we will contact your family members listed in your device directory. Support email: info@quickpaisa-scam.com.`,
    extractedEntities: {
      phones: [],
      upis: [],
      emails: ["info@quickpaisa-scam.com"],
      urls: [],
      transactions: [],
      accounts: ["918273645029"],
      ifscs: ["UTIB0000999"],
      ips: ["104.244.42.1"],
      amounts: ["5,000", "8,500", "500"],
      dates: ["7 days"],
      usernames: []
    }
  },
  {
    id: "E-105",
    caseId: "CX-2026-0403",
    fileName: "extortion_sms.png",
    fileType: "SMS",
    uploadedAt: "2026-06-14T12:15:00Z",
    uploadedBy: "Inspector S. Sharma",
    size: "340 KB",
    ocrLanguage: "English/Hindi",
    ocrConfidence: 89,
    hash: "e5f6a7b8c9d0e1f2a3b4c5d6e7f8a9b0c1d2e3f4a5b6c7d8e9f0a1b2c3d4e5f6",
    tags: ["sms", "extortion", "threat"],
    ocrText: `[ALERT] Dear Customer, your loan repayment of 8500 Rs is overdue. 
तुमने पैसे नहीं दिए तो तुम्हारी Morph Photo तुम्हारे सभी कांटेक्ट को भेज दी जाएगी। 
Pay immediately to UPI: securepay.mule@okaxis.
Otherwise see your photos on social media. Call +91 91234 56789.`,
    extractedEntities: {
      phones: ["+91 91234 56789"],
      upis: ["securepay.mule@okaxis"],
      emails: [],
      urls: [],
      transactions: [],
      accounts: [],
      ifscs: [],
      ips: [],
      amounts: ["8500 Rs"],
      dates: [],
      usernames: []
    }
  }
];

export const initialEntities = [
  {
    id: "phone:+919123456789",
    type: "Mobile Number",
    value: "+91 91234 56789",
    riskScore: "Critical",
    casesLinked: ["CX-2026-0401", "CX-2026-0403"],
    details: "Suspect contact number found in Telegram crypto group and Loan App extortion SMS. Traced to a fake identity SIM in Bharatpur."
  },
  {
    id: "phone:+919898989898",
    type: "Mobile Number",
    value: "+91 98989 89898",
    riskScore: "High",
    casesLinked: ["CX-2026-0402"],
    details: "Initial solicitor contact number on WhatsApp for Part-time Job Scams."
  },
  {
    id: "upi:vip.invest@oksbi",
    type: "UPI ID",
    value: "vip.invest@oksbi",
    riskScore: "High",
    casesLinked: ["CX-2026-0401"],
    details: "Mule UPI merchant ID registered under 'VIP Crypto Associates'. Bank: SBI."
  },
  {
    id: "upi:securepay.mule@okaxis",
    type: "UPI ID",
    value: "securepay.mule@okaxis",
    riskScore: "Critical",
    casesLinked: ["CX-2026-0402", "CX-2026-0403"],
    details: "Primary receiver UPI ID found in both Job Scam registration fee and Loan App extortion payment message. Strong link between these operations."
  },
  {
    id: "username:@taskmaster_vip",
    type: "Username",
    value: "@taskmaster_vip",
    riskScore: "Critical",
    casesLinked: ["CX-2026-0401", "CX-2026-0402"],
    details: "Telegram user handle acting as administrator and payouts coordinator for both Job Scam and Crypto VIP channels."
  },
  {
    id: "ip:104.244.42.1",
    type: "IP Address",
    value: "104.244.42.1",
    riskScore: "Medium",
    casesLinked: ["CX-2026-0403"],
    details: "Server hosting the malicious Loan APK download file. Located behind a Cloudflare proxy."
  },
  {
    id: "email:info@quickpaisa-scam.com",
    type: "Email Address",
    value: "info@quickpaisa-scam.com",
    riskScore: "Medium",
    casesLinked: ["CX-2026-0403"],
    details: "Support email listed in the Loan App UI."
  },
  {
    id: "account:918273645029",
    type: "Bank Account",
    value: "918273645029",
    riskScore: "High",
    casesLinked: ["CX-2026-0403"],
    details: "Suspect disbursal account. Axis Bank, Noida Branch."
  }
];

export const initialAlerts = [
  {
    id: "A-501",
    type: "Duplicate Entity",
    severity: "Critical",
    title: "Multi-Case UPI Match",
    description: "UPI ID 'securepay.mule@okaxis' was extracted from evidence in both Case CX-2026-0402 (Job Fraud) and Case CX-2026-0403 (Loan App Fraud). Indicates a shared cash-out network.",
    entityType: "UPI ID",
    entityValue: "securepay.mule@okaxis",
    cases: ["CX-2026-0402", "CX-2026-0403"],
    timestamp: "2026-06-14T12:20:00Z"
  },
  {
    id: "A-502",
    type: "Duplicate Entity",
    severity: "Critical",
    title: "Multi-Case Suspect Mobile Match",
    description: "Phone Number '+91 91234 56789' appears in Case CX-2026-0401 (Crypto Scam) and Case CX-2026-0403 (Loan App Extortion). Likely the same organized gang or call center.",
    entityType: "Mobile Number",
    entityValue: "+91 91234 56789",
    cases: ["CX-2026-0401", "CX-2026-0403"],
    timestamp: "2026-06-14T12:16:00Z"
  },
  {
    id: "A-503",
    type: "High Value Transaction",
    severity: "High",
    title: "Mule Account Concentration",
    description: "Multiple transactions flow detected into account '918273645029' from distinct geographical areas in short intervals.",
    entityType: "Bank Account",
    entityValue: "918273645029",
    cases: ["CX-2026-0403"],
    timestamp: "2026-06-14T11:50:00Z"
  }
];

export const initialAuditLogs = [
  {
    id: "L-901",
    timestamp: "2026-06-16T10:00:00Z",
    officer: "Inspector S. Sharma",
    action: "User Login",
    ipAddress: "10.160.22.45"
  },
  {
    id: "L-902",
    timestamp: "2026-06-16T10:15:00Z",
    officer: "Inspector S. Sharma",
    action: "Viewed Case CX-2026-0401",
    ipAddress: "10.160.22.45"
  },
  {
    id: "L-903",
    timestamp: "2026-06-16T11:30:00Z",
    officer: "Sub-Inspector Priya Roy",
    action: "Uploaded Evidence E-104",
    ipAddress: "10.160.22.89"
  },
  {
    id: "L-904",
    timestamp: "2026-06-16T12:05:00Z",
    officer: "Inspector S. Sharma",
    action: "Extracted Entities from E-105",
    ipAddress: "10.160.22.45"
  },
  {
    id: "L-905",
    timestamp: "2026-06-16T13:40:00Z",
    officer: "Sub-Inspector Priya Roy",
    action: "Generated Investigation Report for CX-2026-0402",
    ipAddress: "10.160.22.89"
  }
];
