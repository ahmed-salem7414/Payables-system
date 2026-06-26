import { db } from "../firebase";
import { 
  collection, 
  doc, 
  getDoc, 
  getDocs, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  query,
  where
} from "firebase/firestore";
import { Supplier, Invoice } from "../types";

/**
 * Service for handling CRUD operations on Firestore for Suppliers and Invoices.
 * Bridges local states/database with Firestore.
 */

// --- SUPPLIER CRUD OPERATIONS ---

/**
 * Fetches all suppliers from Firestore.
 */
export async function getSuppliers(): Promise<Supplier[]> {
  try {
    const suppliersCol = collection(db, "suppliers");
    const snapshot = await getDocs(suppliersCol);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id
      } as Supplier;
    });
  } catch (error) {
    console.error("🔥 Error fetching suppliers from Firestore:", error);
    throw error;
  }
}

/**
 * Fetches a single supplier from Firestore by its ID.
 */
export async function getSupplier(id: string): Promise<Supplier | null> {
  try {
    const docRef = doc(db, "suppliers", id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        ...docSnap.data(),
        id: docSnap.id
      } as Supplier;
    }
    return null;
  } catch (error) {
    console.error(`🔥 Error fetching supplier ${id} from Firestore:`, error);
    throw error;
  }
}

/**
 * Creates or overwrites a supplier in Firestore.
 */
export async function createSupplier(supplier: Supplier): Promise<void> {
  try {
    const id = supplier.id || doc(collection(db, "suppliers")).id;
    const docRef = doc(db, "suppliers", id);
    const payload = {
      ...supplier,
      id,
      createdAt: supplier.createdAt || new Date().toISOString()
    };
    await setDoc(docRef, payload);
    console.log(`✅ Supplier ${id} created in Firestore.`);
  } catch (error) {
    console.error("🔥 Error creating supplier in Firestore:", error);
    throw error;
  }
}

/**
 * Updates specific fields of an existing supplier in Firestore.
 */
export async function updateSupplier(id: string, data: Partial<Supplier>): Promise<void> {
  try {
    const docRef = doc(db, "suppliers", id);
    await updateDoc(docRef, data);
    console.log(`✅ Supplier ${id} updated in Firestore.`);
  } catch (error) {
    console.error(`🔥 Error updating supplier ${id} in Firestore:`, error);
    throw error;
  }
}

/**
 * Deletes a supplier from Firestore.
 */
export async function deleteSupplier(id: string): Promise<void> {
  try {
    const docRef = doc(db, "suppliers", id);
    await deleteDoc(docRef);
    console.log(`❌ Supplier ${id} deleted from Firestore.`);
  } catch (error) {
    console.error(`🔥 Error deleting supplier ${id} from Firestore:`, error);
    throw error;
  }
}

// --- INVOICE CRUD OPERATIONS ---

/**
 * Fetches all invoices from Firestore.
 */
export async function getInvoices(): Promise<Invoice[]> {
  try {
    const invoicesCol = collection(db, "invoices");
    const snapshot = await getDocs(invoicesCol);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id
      } as Invoice;
    });
  } catch (error) {
    console.error("🔥 Error fetching invoices from Firestore:", error);
    throw error;
  }
}

/**
 * Fetches a single invoice from Firestore by its ID.
 */
export async function getInvoice(id: string): Promise<Invoice | null> {
  try {
    const docRef = doc(db, "invoices", id);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      return {
        ...docSnap.data(),
        id: docSnap.id
      } as Invoice;
    }
    return null;
  } catch (error) {
    console.error(`🔥 Error fetching invoice ${id} from Firestore:`, error);
    throw error;
  }
}

/**
 * Creates or overwrites an invoice in Firestore.
 */
export async function createInvoice(invoice: Invoice): Promise<void> {
  try {
    const id = invoice.id || doc(collection(db, "invoices")).id;
    const docRef = doc(db, "invoices", id);
    const payload = {
      ...invoice,
      id
    };
    await setDoc(docRef, payload);
    console.log(`✅ Invoice ${id} created in Firestore.`);
  } catch (error) {
    console.error("🔥 Error creating invoice in Firestore:", error);
    throw error;
  }
}

/**
 * Updates specific fields of an existing invoice in Firestore.
 */
export async function updateInvoice(id: string, data: Partial<Invoice>): Promise<void> {
  try {
    const docRef = doc(db, "invoices", id);
    await updateDoc(docRef, data);
    console.log(`✅ Invoice ${id} updated in Firestore.`);
  } catch (error) {
    console.error(`🔥 Error updating invoice ${id} in Firestore:`, error);
    throw error;
  }
}

/**
 * Deletes an invoice from Firestore.
 */
export async function deleteInvoice(id: string): Promise<void> {
  try {
    const docRef = doc(db, "invoices", id);
    await deleteDoc(docRef);
    console.log(`❌ Invoice ${id} deleted from Firestore.`);
  } catch (error) {
    console.error(`🔥 Error deleting invoice ${id} from Firestore:`, error);
    throw error;
  }
}

/**
 * Fetches invoices for a specific supplier.
 */
export async function getInvoicesBySupplier(supplierId: string): Promise<Invoice[]> {
  try {
    const invoicesCol = collection(db, "invoices");
    const q = query(invoicesCol, where("supplierId", "==", supplierId));
    const snapshot = await getDocs(q);
    return snapshot.docs.map(doc => {
      const data = doc.data();
      return {
        ...data,
        id: doc.id
      } as Invoice;
    });
  } catch (error) {
    console.error(`🔥 Error fetching invoices for supplier ${supplierId}:`, error);
    throw error;
  }
}
