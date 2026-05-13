import axios from "axios";

export async function upsertTransaction(transaction: any) {
  try {
    await axios.post(
      `${process.env.AI_SERVICE_URL}/api/upsert-transaction`,
      transaction,
    );
  } catch (error) {
    console.error("Error upserting transaction:", error);
  }
}
