
require("dotenv").config();

const PORT = process.env.PORT || 3000;
const uri = process.env.MONGODB_URI;

const dns = require("dns");
dns.setServers(["8.8.8.8", "1.1.1.1"]);

const express = require("express");
const { MongoClient } = require("mongodb");
const path = require("path");
const session = require("express-session");
const MongoStore = require("connect-mongo").default;
const bcrypt = require("bcryptjs");

if (!uri) {
  throw new Error("MONGODB_URI is missing from .env");
}

if (!process.env.SESSION_SECRET) {
  throw new Error("SESSION_SECRET is missing from .env");
}

const app = express();
const client = new MongoClient(uri);

app.use(express.json());

app.use(session({
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  store: MongoStore.create({
    mongoUrl: uri,
    dbName: "library_management",
    collectionName: "sessions",
    ttl: 60 * 60 * 8
  }),
  cookie: {
    httpOnly: true,
    sameSite: "lax",
    secure: false,
    maxAge: 1000 * 60 * 60 * 8
  }
}));

app.use(express.static(path.join(__dirname, "public")));

let db;

// ---------------- AUTHENTICATION ----------------

function requireLogin(req, res, next) {
  if (!req.session || !req.session.staff) {
    return res.status(401).json({
      error: "Please log in to perform this operation."
    });
  }

  next();
}

app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({
        error: "Username and password are required."
      });
    }

    const staff = await db.collection("staff").findOne({ username });

    if (
      !staff ||
      !staff.passwordHash ||
      !(await bcrypt.compare(password, staff.passwordHash))
    ) {
      return res.status(401).json({
        error: "Invalid username or password."
      });
    }

    req.session.regenerate((err) => {
      if (err) {
        return res.status(500).json({ error: "Login failed." });
      }

      req.session.staff = {
        staffId: staff.staffId,
        username: staff.username,
        role: staff.role
      };

      req.session.save((saveErr) => {
        if (saveErr) {
          return res.status(500).json({
            error: "Could not save session."
          });
        }

        res.json({
          message: "Login successful.",
          staff: req.session.staff
        });
      });
    });
  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ error: "Server error during login." });
  }
});

app.get("/api/me", (req, res) => {
  if (!req.session.staff) {
    return res.status(401).json({ error: "Not logged in." });
  }

  res.json({ staff: req.session.staff });
});

app.post("/api/logout", (req, res) => {
  req.session.destroy((err) => {
    if (err) {
      return res.status(500).json({ error: "Logout failed." });
    }

    res.clearCookie("connect.sid");
    res.json({ message: "Logged out successfully." });
  });
});

// ---------------- HEALTH CHECK ----------------

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "Library Management API is running"
  });
});

// ---------------- BOOKS ----------------

app.get("/api/books", async (req, res) => {
  try {
    const books = await db.collection("books")
      .find({})
      .sort({ bookId: 1 })
      .toArray();

    res.json(books);
  } catch (error) {
    console.error("Books error:", error);
    res.status(500).json({ error: "Failed to retrieve books." });
  }
});

app.post("/api/books", requireLogin, async (req, res) => {
  try {
    const {
      bookId, title, genre, publisher, publishedYear, totalCopies
    } = req.body;

    if (!bookId || !title || !genre) {
      return res.status(400).json({
        error: "Book ID, title, and genre are required."
      });
    }

    const existing = await db.collection("books").findOne({ bookId });

    if (existing) {
      return res.status(409).json({
        error: "A book with this ID already exists."
      });
    }

    const copiesCount = Math.max(1, Number(totalCopies) || 1);

    const newBook = {
      bookId,
      title,
      genre,
      publisher: publisher || "Unknown",
      publishedYear: Number(publishedYear) || new Date().getFullYear(),
      authors: [],
      copies: Array.from({ length: copiesCount }, (_, i) => ({
        accessionNo: `${bookId}-COPY-${i + 1}`,
        status: "Available"
      })),
      totalCopies: copiesCount,
      availableCopies: copiesCount
    };

    await db.collection("books").insertOne(newBook);

    res.status(201).json({
      message: "Book added successfully.",
      book: newBook
    });
  } catch (error) {
    console.error("Create book error:", error);
    res.status(500).json({ error: "Failed to add book." });
  }
});

app.patch("/api/books/:bookId", requireLogin, async (req, res) => {
  try {
    const { title, genre, publisher, publishedYear } = req.body;
    const updates = {};

    if (typeof title === "string" && title.trim()) {
      updates.title = title.trim();
    }

    if (typeof genre === "string" && genre.trim()) {
      updates.genre = genre.trim();
    }

    if (typeof publisher === "string") {
      updates.publisher = publisher.trim();
    }

    if (publishedYear !== undefined) {
      const year = Number(publishedYear);

      if (!Number.isInteger(year) || year < 0 || year > 9999) {
        return res.status(400).json({
          error: "Enter a valid publication year."
        });
      }

      updates.publishedYear = year;
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({
        error: "Provide at least one valid field to update."
      });
    }

    const result = await db.collection("books").updateOne(
      { bookId: req.params.bookId },
      { $set: updates }
    );

    if (result.matchedCount === 0) {
      return res.status(404).json({ error: "Book not found." });
    }

    res.json({ message: "Book updated successfully." });
  } catch (error) {
    console.error("Update book error:", error);
    res.status(500).json({ error: "Failed to update book." });
  }
});

app.delete("/api/books/:bookId", requireLogin, async (req, res) => {
  try {
    const bookId = req.params.bookId;

    const book = await db.collection("books").findOne({ bookId });

    if (!book) {
      return res.status(404).json({ error: "Book not found." });
    }

    const activeTransaction = await db.collection("transactions").findOne({
      bookId,
      status: "Issued"
    });

    if (activeTransaction) {
      return res.status(409).json({
        error: "Cannot delete a book with an active issue transaction."
      });
    }

    const reservation = await db.collection("reservations").findOne({
      bookId,
      status: { $in: ["Pending", "Reserved", "Active"] }
    });

    if (reservation) {
      return res.status(409).json({
        error: "Cannot delete a book with an active reservation."
      });
    }

    await db.collection("books").deleteOne({ bookId });

    res.json({ message: "Book deleted successfully." });
  } catch (error) {
    console.error("Delete book error:", error);
    res.status(500).json({ error: "Failed to delete book." });
  }
});

// ---------------- MEMBERS ----------------

app.get("/api/members", async (req, res) => {
  try {
    const members = await db.collection("members")
      .find({})
      .limit(100)
      .toArray();

    res.json(members);
  } catch (error) {
    console.error("Members error:", error);
    res.status(500).json({ error: "Failed to retrieve members." });
  }
});

app.post("/api/members", requireLogin, async (req, res) => {
  try {
    const { memberId, name, email, phone, membershipType } = req.body;

    if (!memberId || !name || !email) {
      return res.status(400).json({
        error: "Member ID, name, and email are required."
      });
    }

    const cleanId = memberId.trim();
    const cleanEmail = email.trim().toLowerCase();

    const existing = await db.collection("members").findOne({
      $or: [
        { memberId: cleanId },
        { email: cleanEmail }
      ]
    });

    if (existing) {
      return res.status(409).json({
        error: "A member with this ID or email already exists."
      });
    }

    const member = {
      memberId: cleanId,
      name: name.trim(),
      email: cleanEmail,
      phone: phone || "",
      membershipType: membershipType || "Standard",
      joinDate: new Date()
    };

    await db.collection("members").insertOne(member);

    res.status(201).json({
      message: "Member registered successfully.",
      member
    });
  } catch (error) {
    console.error("Register member error:", error);
    res.status(500).json({ error: "Failed to register member." });
  }
});

// ---------------- ISSUE BOOK ----------------

app.post("/api/transactions/issue", requireLogin, async (req, res) => {
  const { memberId, bookId } = req.body;

  if (!memberId || !bookId) {
    return res.status(400).json({
      error: "Member ID and Book ID are required."
    });
  }

  const mongoSession = client.startSession();

  try {
    let issuedTransaction;

    await mongoSession.withTransaction(async () => {
      const book = await db.collection("books").findOne(
        { bookId },
        { session: mongoSession }
      );

      if (!book) throw new Error("BOOK_NOT_FOUND");

      const member = await db.collection("members").findOne(
        { memberId },
        { session: mongoSession }
      );

      if (!member) throw new Error("MEMBER_NOT_FOUND");

      const availableCopy = (book.copies || []).find(
        copy => copy.status === "Available"
      );

      if (!availableCopy) throw new Error("NO_AVAILABLE_COPY");

      const issueDate = new Date();
      const dueDate = new Date(issueDate);
      dueDate.setDate(dueDate.getDate() + 14);

      const transactionId = `TXN-${Date.now()}`;

      const copyUpdate = await db.collection("books").updateOne(
        {
          bookId,
          copies: {
            $elemMatch: {
              accessionNo: availableCopy.accessionNo,
              status: "Available"
            }
          }
        },
        {
          $set: { "copies.$.status": "Issued" },
          $inc: { availableCopies: -1 }
        },
        { session: mongoSession }
      );

      if (copyUpdate.modifiedCount !== 1) {
        throw new Error("COPY_NO_LONGER_AVAILABLE");
      }

      issuedTransaction = {
        transactionId,
        memberId,
        bookId,
        accessionNo: availableCopy.accessionNo,
        issueDate,
        dueDate,
        returnDate: null,
        status: "Issued",
        fine: { amount: 0, paid: false }
      };

      await db.collection("transactions").insertOne(
        issuedTransaction,
        { session: mongoSession }
      );
    });

    res.status(201).json({
      message: "Book issued successfully.",
      transaction: issuedTransaction
    });
  } catch (error) {
    const errors = {
      BOOK_NOT_FOUND: [404, "Book not found."],
      MEMBER_NOT_FOUND: [404, "Member not found."],
      NO_AVAILABLE_COPY: [409, "No available copies of this book."],
      COPY_NO_LONGER_AVAILABLE: [409, "That copy is no longer available."]
    };

    const [status, message] = errors[error.message] || [
      500, "Failed to issue book."
    ];

    console.error("Issue book error:", error);
    res.status(status).json({ error: message });
  } finally {
    await mongoSession.endSession();
  }
});

// ---------------- RETURN BOOK ----------------

app.post(
  "/api/transactions/:transactionId/return",
  requireLogin,
  async (req, res) => {
    const { transactionId } = req.params;
    const mongoSession = client.startSession();

    try {
      await mongoSession.withTransaction(async () => {
        const transaction = await db.collection("transactions").findOne(
          { transactionId, status: "Issued" },
          { session: mongoSession }
        );

        if (!transaction) {
          throw new Error("ACTIVE_TRANSACTION_NOT_FOUND");
        }

        const bookUpdate = await db.collection("books").updateOne(
          {
            bookId: transaction.bookId,
            copies: {
              $elemMatch: {
                accessionNo: transaction.accessionNo,
                status: "Issued"
              }
            }
          },
          {
            $set: { "copies.$.status": "Available" },
            $inc: { availableCopies: 1 }
          },
          { session: mongoSession }
        );

        if (bookUpdate.modifiedCount !== 1) {
          throw new Error("ISSUED_COPY_NOT_FOUND");
        }

        await db.collection("transactions").updateOne(
          { _id: transaction._id, status: "Issued" },
          {
            $set: {
              status: "Returned",
              returnDate: new Date()
            }
          },
          { session: mongoSession }
        );
      });

      res.json({ message: "Book returned successfully." });
    } catch (error) {
      const errors = {
        ACTIVE_TRANSACTION_NOT_FOUND: [
          404, "No active issue transaction found."
        ],
        ISSUED_COPY_NOT_FOUND: [
          409, "The issued copy could not be found."
        ]
      };

      const [status, message] = errors[error.message] || [
        500, "Failed to return book."
      ];

      console.error("Return book error:", error);
      res.status(status).json({ error: message });
    } finally {
      await mongoSession.endSession();
    }
  }
);

/* ---------------- ANALYTICS DASHBOARD ---------------- */

app.get("/api/analytics", requireLogin, async (req, res) => {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // 1. Most borrowed books
    const mostBorrowed = await db.collection("transactions").aggregate([
      {
        $group: {
          _id: "$bookId",
          borrowCount: { $sum: 1 }
        }
      },
      { $sort: { borrowCount: -1 } },
      { $limit: 5 },
      {
        $lookup: {
          from: "books",
          localField: "_id",
          foreignField: "bookId",
          as: "book"
        }
      },
      {
        $project: {
          _id: 0,
          bookId: "$_id",
          borrowCount: 1,
          title: {
            $ifNull: [
              { $arrayElemAt: ["$book.title", 0] },
              "Unknown book"
            ]
          }
        }
      }
    ]).toArray();

    // 2. Currently overdue loans
    const overdueLoans = await db.collection("transactions").aggregate([
      {
        $match: {
          status: "Issued",
          dueDate: { $lt: today }
        }
      },
      {
        $lookup: {
          from: "members",
          localField: "memberId",
          foreignField: "memberId",
          as: "member"
        }
      },
      {
        $lookup: {
          from: "books",
          localField: "bookId",
          foreignField: "bookId",
          as: "book"
        }
      },
      {
        $project: {
          _id: 0,
          transactionId: 1,
          memberId: 1,
          bookId: 1,
          dueDate: 1,
          memberName: {
            $ifNull: [
              { $arrayElemAt: ["$member.name", 0] },
              "Unknown member"
            ]
          },
          bookTitle: {
            $ifNull: [
              { $arrayElemAt: ["$book.title", 0] },
              "Unknown book"
            ]
          }
        }
      },
      { $sort: { dueDate: 1 } }
    ]).toArray();

    // 3. Books grouped by genre
    const booksByGenre = await db.collection("books").aggregate([
      {
        $group: {
          _id: { $ifNull: ["$genre", "Unspecified"] },
          bookCount: { $sum: 1 },
          totalCopies: {
            $sum: { $ifNull: ["$totalCopies", 0] }
          },
          availableCopies: {
            $sum: { $ifNull: ["$availableCopies", 0] }
          }
        }
      },
      { $sort: { bookCount: -1 } },
      {
        $project: {
          _id: 0,
          genre: "$_id",
          bookCount: 1,
          totalCopies: 1,
          availableCopies: 1
        }
      }
    ]).toArray();

    // 4. Transaction status summary
    const transactionSummary = await db.collection("transactions").aggregate([
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 }
        }
      },
      {
        $project: {
          _id: 0,
          status: "$_id",
          count: 1
        }
      },
      { $sort: { status: 1 } }
    ]).toArray();

    // 5. Fine summary by member
    const fineSummary = await db.collection("transactions").aggregate([
      {
        $group: {
          _id: "$memberId",
          totalFine: {
            $sum: { $ifNull: ["$fine.amount", 0] }
          },
          unpaidFine: {
            $sum: {
              $cond: [
                { $eq: ["$fine.paid", false] },
                { $ifNull: ["$fine.amount", 0] },
                0
              ]
            }
          },
          transactionCount: { $sum: 1 }
        }
      },
      {
        $lookup: {
          from: "members",
          localField: "_id",
          foreignField: "memberId",
          as: "member"
        }
      },
      {
        $project: {
          _id: 0,
          memberId: "$_id",
          memberName: {
            $ifNull: [
              { $arrayElemAt: ["$member.name", 0] },
              "Unknown member"
            ]
          },
          totalFine: 1,
          unpaidFine: 1,
          transactionCount: 1
        }
      },
      { $sort: { totalFine: -1 } },
      { $limit: 10 }
    ]).toArray();

    res.json({
      generatedAt: new Date(),
      mostBorrowed,
      overdueLoans,
      booksByGenre,
      transactionSummary,
      fineSummary
    });
  } catch (error) {
    console.error("Analytics error:", error);
    res.status(500).json({
      error: "Failed to generate analytics."
    });
  }
});


// ---------------- TRANSACTIONS ----------------

app.get("/api/transactions", async (req, res) => {
  try {
    const transactions = await db.collection("transactions")
      .find({})
      .sort({ issueDate: -1 })
      .limit(200)
      .toArray();

    res.json(transactions);
  } catch (error) {
    console.error("Transactions error:", error);
    res.status(500).json({
      error: "Failed to retrieve transactions."
    });
  }
});

// ---------------- RESERVATIONS ----------------

app.get("/api/reservations", async (req, res) => {
  try {
    const reservations = await db.collection("reservations")
      .find({})
      .sort({ reservationDate: -1 })
      .limit(200)
      .toArray();

    res.json(reservations);
  } catch (error) {
    console.error("Reservations error:", error);
    res.status(500).json({
      error: "Failed to retrieve reservations."
    });
  }
});

app.post("/api/reservations", requireLogin, async (req, res) => {
  try {
    const { memberId, bookId } = req.body;

    if (!memberId || !bookId) {
      return res.status(400).json({
        error: "Member ID and Book ID are required."
      });
    }

    const member = await db.collection("members").findOne({ memberId });

    if (!member) {
      return res.status(404).json({ error: "Member not found." });
    }

    const book = await db.collection("books").findOne({ bookId });

    if (!book) {
      return res.status(404).json({ error: "Book not found." });
    }

    const existing = await db.collection("reservations").findOne({
      memberId,
      bookId,
      status: { $in: ["Pending", "Reserved", "Active"] }
    });

    if (existing) {
      return res.status(409).json({
        error: "This member already has an active reservation for this book."
      });
    }

    const reservation = {
      reservationId: `RES-${Date.now()}`,
      memberId,
      bookId,
      reservationDate: new Date(),
      status: "Pending"
    };

    await db.collection("reservations").insertOne(reservation);

    res.status(201).json({
      message: "Reservation created successfully.",
      reservation
    });
  } catch (error) {
    console.error("Create reservation error:", error);
    res.status(500).json({
      error: "Failed to create reservation."
    });
  }
});

// ---------------- START SERVER ----------------

async function startServer() {
  try {
    await client.connect();
    db = client.db("library_management");

    app.listen(PORT, () => {
      console.log(
        `Library Management API running at http://localhost:${PORT}`
      );
    });
  } catch (error) {
    console.error("Failed to start application:", error);
    process.exit(1);
  }
}

startServer();
