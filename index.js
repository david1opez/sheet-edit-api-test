import express from 'express';
import { getFirestore, collection, query, where, getDocs, doc, writeBatch, setDoc } from 'firebase/firestore';
import cors from 'cors';
import { initializeApp } from 'firebase/app';
import dotenv from 'dotenv';

dotenv.config();

const firebaseConfig = {
  apiKey: process.env.API_KEY,
  authDomain: process.env.AUTH_DOMAIN,
  projectId: process.env.PROJECT_ID,
  storageBucket: process.env.STORAGE_BUCKET,
  messagingSenderId: process.env.MESSAGING_SENDER_ID,
  appId: process.env.APP_ID,
};

const firebaseApp = initializeApp(firebaseConfig);
const db = getFirestore(firebaseApp);

const app = express();

app.use(cors());
app.use(express.json());

app.get('/projects', async (req, res) => {
  try {
    const collectionRef = collection(db, 'Proyectos');
    const querySnapshot = await getDocs(collectionRef);

    const projects = querySnapshot.docs.map(doc => ({
      id: doc.id,
      ...doc.data(),
    }));

    res.json(projects);
  } catch (error) {
    console.error('Error fetching projects:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/sheetToDb', async (req, res) => {
  try {
    const { rows, columnNames, values } = req.body;
    if (!rows || !columnNames || !values) {
      return res.status(400).json({ error: 'Invalid request payload' });
    }

    const rowNumbers = Array.from({ length: rows.end - rows.start + 1 }, (_, i) => rows.start + i);
    const collectionRef = collection(db, 'Proyectos');
    const q = query(collectionRef, where('row', 'in', rowNumbers));
    const querySnapshot = await getDocs(q);

    const foundRows = new Set();
    const batch = writeBatch(db);
    querySnapshot.forEach((document) => {
      foundRows.add(document.data().row);
      const rowData = values[rowNumbers.indexOf(document.data().row)].reduce((acc, val, idx) => {
        acc[columnNames[idx]] = val;
        return acc;
      }, {});
      batch.set(doc(db, 'Proyectos', document.id), rowData, { merge: true });
    });

    rowNumbers.forEach((rowNumber, index) => {
      if (!foundRows.has(rowNumber)) {
        const newRowData = values[index].reduce((acc, val, idx) => {
          acc[columnNames[idx]] = val;
          return acc;
        }, {});
        newRowData.row = rowNumber;
        const newDocRef = doc(collectionRef);
        batch.set(newDocRef, newRowData);
      }
    });

    await batch.commit();
    res.json({ message: 'Data successfully updated in Firestore' });
  } catch (error) {
    console.error('Error updating Firestore:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
