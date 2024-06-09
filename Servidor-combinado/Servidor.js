const express = require('express');
const axios = require('axios');
const grpc = require('@grpc/grpc-js');
const protoLoader = require('@grpc/proto-loader');
const multer = require('multer');
const https = require('https');
const path = require('path');
const fs = require('fs');
const cors = require('cors');  // Importar el paquete CORS

const app = express();
const PORT = 8081;
const API_URL = 'http://ceron-eng.somee.com/api/Autor';

// Configurar multer para manejar la carga de archivos
const upload = multer({ dest: 'uploads/' });

// Cargar el archivo proto
const PROTO_PATH = path.join(__dirname, 'image.proto');
const packageDefinition = protoLoader.loadSync(PROTO_PATH, {
    keepCase: true,
    longs: String,
    enums: String,
    defaults: true,
    oneofs: true
});
const imageProto = grpc.loadPackageDefinition(packageDefinition).greet;

// Crear un cliente gRPC
const client = new imageProto.ImageService('localhost:5272', grpc.credentials.createInsecure());

// Crear una instancia de axios con el agente HTTPS que rechaza los certificados no autorizados
const api = axios.create({
    baseURL: API_URL,
    httpsAgent: new https.Agent({
        rejectUnauthorized: false
    })
});

// Usar el middleware de CORS
app.use(cors());

app.use(express.json());

// Rutas para la API REST
const getAutores = async () => {
    try {
        const response = await api.get('/');
        return response.data;
    } catch (error) {
        console.error('Error fetching authors:', error);
        throw error;
    }
};

const getAutor = async (id) => {
    try {
        const response = await api.get(`/${id}`);
        return response.data;
    } catch (error) {
        console.error(`Error fetching author with id ${id}:`, error);
        throw error;
    }
};

const createAutor = async (autorData) => {
    try {
        const response = await api.post('/', autorData);
        console.log(response);
        return response.data;
    } catch (error) {
        console.error('Error creating author:', error);
        throw error;
    }
};

app.get('/autores', async (req, res) => {
    try {
        const autores = await getAutores();
        res.json(autores);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.get('/autores/:id', async (req, res) => {
    try {
        const autor = await getAutor(req.params.id);
        res.json(autor);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

app.post('/autores', async (req, res) => {
    try {
        const newAutor = await createAutor(req.body);
        res.status(201).json(newAutor);
    } catch (error) {
        res.status(500).send(error.message);
    }
});

// Configuración de Multer para manejar la carga de archivos
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/');
  },
  filename: function (req, file, cb) {
    cb(null, file.originalname);
  }
});


// Ruta para el servicio gRPC
app.post('/autores/save-image', upload.single('image'), (req, res) => {
  const { file } = req;
  const { guid } = req.body;

  if (!file) {
    return res.status(400).send({ success: false, message: 'No file uploaded' });
  }

  // Leer la imagen
  const image_data = fs.readFileSync(file.path);

  // Crear un mensaje de solicitud (request)
  const request = {
    guid: guid || 'some-guid',
    name: file.originalname,
    image: image_data
  };

  // Hacer la llamada al servicio gRPC
  client.SaveImage(request, (error, response) => {
    if (error) {
      return res.status(500).send({ success: false, message: error.message });
    }
    res.send(response);
  });
});

app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
});
