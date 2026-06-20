const BASE_URL = 'http://localhost:3001/api';

async function runTests() {
  console.log('🧪 Starting Security & Case Approval E2E Handshake Verification...\n');

  // Helper for JSON request
  async function request(endpoint, method = 'GET', body = null, headers = {}) {
    const config = {
      method,
      headers: { 'Content-Type': 'application/json', ...headers }
    };
    if (body) config.body = JSON.stringify(body);
    const res = await fetch(`${BASE_URL}${endpoint}`, config);
    const data = await res.json();
    return { status: res.status, data };
  }

  // ─── 1. Password Strength Validation Check ───
  console.log('1. Testing registration password policy...');
  const regWeak = await request('/auth/register', 'POST', {
    username: 'test_io',
    email: 'test_io@chronex.gov.in',
    password: 'weak', // fails min 12, uppercase, lowercase, special
    role: 'INVESTIGATION OFFICER',
    name: 'Officer Test'
  });
  if (regWeak.status === 400 && regWeak.data.error.includes('Weak Password')) {
    console.log('✅ Weak password rejected successfully.');
  } else {
    console.error('❌ Weak password registration failed to reject!', regWeak);
  }

  // ─── 2. User Authentication & Simulated MFA Flow ───
  console.log('\n2. Testing login with SP credentials...');
  // We'll use the seed user 'sp' / 'Superintendent123!'
  const loginRes = await request('/auth/login', 'POST', {
    identity: 'sp',
    password: 'Superintendent123!'
  });

  if (loginRes.status === 200 && loginRes.data.mfa_required) {
    console.log('✅ SP Login triggers MFA requirement successfully.');
    const tempToken = loginRes.data.temp_token;
    const mockOtp = loginRes.data.mock_otp;
    console.log(`[Simulation] temp_token received. Mock OTP: ${mockOtp}`);

    // Verify MFA OTP
    console.log('Verifying MFA OTP...');
    const mfaRes = await request('/auth/verify-mfa', 'POST', {
      temp_token: tempToken,
      otp: mockOtp
    });

    if (mfaRes.status === 200 && mfaRes.data.token) {
      console.log('✅ MFA verification succeeded. Session JWT obtained.');
      const spToken = mfaRes.data.token;

      // ─── 3. Case Creation & Approval Lockout ───
      console.log('\n3. Registering a new case under the IO...');
      // Login as IO: 'inspector' / 'Inspector123!'
      const ioLogin = await request('/auth/login', 'POST', {
        identity: 'inspector',
        password: 'Inspector123!'
      });
      const ioToken = ioLogin.data.token; // No MFA required for IO in seed

      const newCase = await request('/cases', 'POST', {
        title: 'Cyber Heist Incident',
        classification: 'Investment Scam',
        priority: 'High',
        victim_name: 'Amit Patel',
        assigned_officer: 'inspector'
      }, { 'Authorization': `Bearer ${ioToken}` });

      const caseId = newCase.data.id;
      console.log(`Case registered. ID: ${caseId}, Status: ${newCase.data.status}`);
      if (newCase.data.status === 'Pending Approval') {
        console.log('✅ Registered case correctly defaulted to Pending Approval.');
      } else {
        console.error('❌ Case status is not Pending Approval!', newCase.data);
      }

      // Try uploading evidence as IO to the pending case
      console.log('Attempting to upload evidence to Pending case (should fail)...');
      // For this test, we can use the manual text body mock inside req.body
      const uploadRes = await request('/evidence/upload', 'POST', {
        caseId,
        fileType: 'WhatsApp Chat',
        customText: 'Fake Suspect Chat Log'
      }, { 'Authorization': `Bearer ${ioToken}` });

      if (uploadRes.status === 403 && uploadRes.data.error.toLowerCase().includes('locked')) {
        console.log('✅ Evidence uploading locked successfully.');
      } else {
        console.error('❌ Evidence uploading was not locked!', uploadRes);
      }

      // Try adding a timeline event
      console.log('Attempting to add timeline event (should fail)...');
      const timelineRes = await request(`/timeline/${caseId}`, 'POST', {
        timestamp: new Date().toISOString(),
        title: 'Suspect Geolocation ping',
        description: 'Target pinged at tower'
      }, { 'Authorization': `Bearer ${ioToken}` });

      if (timelineRes.status === 403 && timelineRes.data.error.includes('Blocked')) {
        console.log('✅ Timeline creation locked successfully.');
      } else {
        console.error('❌ Timeline creation was not locked!', timelineRes);
      }

      // ─── 4. SP Case Approval ───
      console.log('\n4. SP approving the case dossier...');
      const approveRes = await request(`/cases/${caseId}/approve`, 'PATCH', {
        action: 'approve',
        remarks: 'Evidence dossier validated. Proceed with investigation.'
      }, { 'Authorization': `Bearer ${spToken}` });

      if (approveRes.status === 200 && approveRes.data.case.status === 'Under Investigation') {
        console.log('✅ Case approved and status updated to Under Investigation.');
      } else {
        console.error('❌ Case approval failed!', approveRes);
      }

      // Retry evidence upload after approval
      console.log('Retrying evidence upload to Approved case...');
      const uploadSuccess = await request('/evidence/upload', 'POST', {
        caseId,
        fileType: 'WhatsApp Chat',
        customText: 'Valid Chat log containing target upi: suspect@paytm'
      }, { 'Authorization': `Bearer ${ioToken}` });

      if (uploadSuccess.status === 201) {
        console.log('✅ Evidence uploaded successfully to approved case dossier.');
      } else {
        console.error('❌ Evidence upload failed after approval!', uploadSuccess);
      }

      // ─── 5. Lockout Brute Force Verification ───
      console.log('\n5. Testing Account Lockout protection...');
      for (let i = 1; i <= 5; i++) {
        const failRes = await request('/auth/login', 'POST', {
          identity: 'inspector',
          password: 'WrongPassword!'
        });
        console.log(`Failed login attempt ${i}: HTTP ${failRes.status} - ${failRes.data.error}`);
        if (i === 5 && failRes.status === 401 && failRes.data.error.includes('Locked')) {
          console.log('✅ Brute-force account lockout successfully triggered!');
        }
      }

    } else {
      console.error('❌ SP MFA Verification failed!', mfaRes);
    }
  } else {
    console.error('❌ SP Login failed!', loginRes);
  }

  console.log('\n🏁 Verification tests completed.');
}

runTests();
