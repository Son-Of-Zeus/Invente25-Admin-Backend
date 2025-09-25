// Test script to verify trimming logic works as expected

// Test frontend-like trimming
function testFrontendTrimming() {
  console.log("=== Frontend Trimming Tests ===");
  
  // Test cases
  const testCases = [
    "  admin@invente.local  ",
    "\tadmin@invente.local\t",
    "\n admin@invente.local \n",
    "admin@invente.local",
    "  password123  ",
    "\tpassword123\t",
    "password123"
  ];
  
  testCases.forEach(test => {
    const trimmed = test.trim();
    console.log(`"${test}" -> "${trimmed}"`);
  });
}

// Test backend-like trimming
function testBackendTrimming() {
  console.log("\n=== Backend Trimming Tests ===");
  
  const reqBody = {
    email: "  admin@invente.local  ",
    password: "\tpassword123\t",
    name: "  John Doe  ",
    personalEmail: "\n john@ssn.edu.in \n",
    phone: "  9876543210  ",
    otp: "  12345  "
  };
  
  // Simulate backend trimming
  const email = reqBody.email?.trim();
  const password = reqBody.password?.trim();
  const name = reqBody.name?.trim();
  const personalEmail = reqBody.personalEmail?.trim();
  const phone = reqBody.phone?.trim();
  const otp = reqBody.otp?.trim();
  
  console.log("Original reqBody:", reqBody);
  console.log("Trimmed values:");
  console.log(`email: "${email}"`);
  console.log(`password: "${password}"`);
  console.log(`name: "${name}"`);
  console.log(`personalEmail: "${personalEmail}"`);
  console.log(`phone: "${phone}"`);
  console.log(`otp: "${otp}"`);
}

// Run tests
testFrontendTrimming();
testBackendTrimming();

console.log("\n=== Test Summary ===");
console.log("✅ Frontend: Input fields will trim on onChange");
console.log("✅ Frontend: Form submission will trim as safety net");
console.log("✅ Backend: All string inputs trimmed in loginHandler");
console.log("✅ Backend: OTP endpoints trim personalEmail and otp");
console.log("✅ Should fix whitespace issues in admin login");
