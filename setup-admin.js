
require("dotenv").config();

const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const { MongoClient } = require("mongodb");
const bcrypt = require("bcryptjs");
const readline = require("readline");

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});

async function main() {
  const password = await new Promise(resolve => {
    rl.question("Create a password for staff1: ", resolve);
  });

  rl.close();

  if (password.length < 12) {
    throw new Error("Use a password with at least 12 characters.");
  }

  const client = new MongoClient(process.env.MONGODB_URI);

  try {
    await client.connect();

    const result = await client
      .db("library_management")
      .collection("staff")
      .updateOne(
        { staffId: "STF3001" },
        {
          $set: {
            username: "staff1",
            passwordHash: await bcrypt.hash(password, 12),
            role: "Admin"
          }
        }
      );

    if (result.matchedCount === 0) {
      throw new Error("Staff record STF3001 was not found.");
    }

    console.log("Admin password hash saved successfully.");
  } finally {
    await client.close();
  }
}

main().catch(error => {
  console.error("Setup failed:", error.message);
  process.exitCode = 1;
});
