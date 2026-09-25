require("dotenv").config();

const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const { MongoClient } = require("mongodb");

const uri = process.env.MONGODB_URI;

const client = new MongoClient(uri);

async function main() {
    try {
        await client.connect();

        console.log("Connected to MongoDB Atlas");

        const db = client.db("library_management");

        const books = db.collection("books");

        const availableBooks = await books
            .find({
                "copies.status": "Available"
            })
            .limit(5)
            .toArray();

        console.log("\nAvailable Books:\n");

        availableBooks.forEach(book => {
            console.log(
                `${book.bookId} | ${book.title} | ${book.genre}`
            );
        });

    } catch (error) {
        console.error("Error:", error);
    } finally {
        await client.close();
    }
}

main();