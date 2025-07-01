const express = require('express');
const mongoose = require('mongoose');
const multer = require('multer');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// MongoDB bağlantısı
mongoose.connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB bağlantısı başarılı'))
  .catch(err => console.error('MongoDB bağlantı hatası:', err));

// Doküman şeması
const dokumanSchema = new mongoose.Schema({
  binaNo: String,
  tip: String,
  dosyaAdi: String,
  yuklemeTarihi: { type: Date, default: Date.now },
  dosyaData: Buffer,
  dosyaMimeType: String
});

const Dokuman = mongoose.model('Dokuman', dokumanSchema);

// Multer ayarları
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// Dosya yükleme endpoint'i
app.post('/upload', upload.single('file'), async (req, res) => {
  try {
    // binaNo ve tip'i doğrudan body'den almak daha güvenilir
    const { binaNo, tip } = req.body;
    if (!req.file) {
      return res.status(400).json({ success: false, message: 'Dosya seçilmedi.' });
    }
    if (!binaNo || !tip) {
      return res.status(400).json({ success: false, message: 'Bina No ve Tip alanları zorunludur.' });
    }

    const dokuman = new Dokuman({
      binaNo: binaNo,
      tip: tip,
      dosyaAdi: req.file.originalname,
      dosyaData: req.file.buffer,
      dosyaMimeType: req.file.mimetype
    });

    await dokuman.save();
    res.json({ success: true, message: 'Dosya başarıyla yüklendi' });
  } catch (error) {
    console.error('Yükleme hatası:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

// Yüklenmiş dokümanları getiren endpoint
app.get('/documents', async (req, res) => {
  try {
    const search = req.query.search || '';
    
    const buildings = await Dokuman.aggregate([
      // Arama terimiyle eşleşen binaları bul (büyük/küçük harf duyarsız)
      { $match: { binaNo: new RegExp(search, 'i') } },
      // Her binanın belgelerini grupla
      {
        $group: {
          _id: '$binaNo', // Bina adına göre grupla
          documents: {
            $push: { // documents dizisine ekle
              _id: '$_id',
              tip: '$tip',
              dosyaAdi: '$dosyaAdi',
              yuklemeTarihi: '$yuklemeTarihi'
            }
          }
        }
      },
      // Bina adına göre alfabetik sırala
      { $sort: { _id: 1 } }
    ]);
    
    res.json(buildings);
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Belirli bir dokümanı ID ile getiren endpoint
app.get('/document/:id', async (req, res) => {
  try {
    const dokuman = await Dokuman.findById(req.params.id);
    if (!dokuman) {
      return res.status(404).send('Doküman bulunamadı');
    }
    res.set('Content-Type', dokuman.dosyaMimeType);
    res.set('Content-Disposition', `inline; filename="${dokuman.dosyaAdi}"`);
    res.send(dokuman.dosyaData);
  } catch (error) {
    res.status(500).send('Sunucu hatası: ' + error.message);
  }
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log('Server is running on port: ' + PORT);
}); 