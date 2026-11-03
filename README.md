# Resume Builder - AI-Powered LaTeX Resume Tailoring

An intelligent resume tailoring application that uses LLM technology to optimize LaTeX resumes for specific job descriptions while preserving formatting and structure.

## 🚀 Features

- **AI-Powered Tailoring**: Uses OpenAI GPT-5 to intelligently modify resume content
- **LaTeX Preservation**: Maintains all formatting, structure, and LaTeX commands
- **Keyword Extraction**: Automatically extracts relevant keywords from job descriptions
- **PDF Compilation**: Generates ready-to-use PDF resumes
- **Modern UI**: Clean, responsive React frontend with Tailwind CSS
- **File Upload**: Support for custom LaTeX resume templates
- **Real-time Preview**: Monaco editor for viewing generated LaTeX

## 🏗️ Architecture

### Backend (Node.js/Express)
- **Resume Ingestion Module**: Validates and loads LaTeX files
- **Job Description Processor**: Sanitizes input and extracts keywords
- **Tailoring Engine**: Core LLM integration for content optimization
- **LaTeX Compiler**: PDF generation with pdflatex
- **API Layer**: RESTful endpoints for frontend communication

### Frontend (React)
- **Tailoring Interface**: Job description input and resume upload
- **Results Dashboard**: LaTeX editor and PDF download
- **Modern Components**: Built with React, React Router, and Tailwind CSS

## 📋 Prerequisites

### System Requirements
- Node.js 16+ and npm
- PostgreSQL (v14 or higher recommended)
- LaTeX distribution (TeX Live, MiKTeX, or MacTeX)
- OpenAI API key (or Anthropic API key)

### PostgreSQL Installation

**macOS (via Homebrew):**
```bash
brew install postgresql@14
brew services start postgresql@14
# Create a default postgres user if one doesn't exist
createuser -s postgres
```

**Ubuntu/Debian:**
```bash
sudo apt update
sudo apt install postgresql postgresql-contrib
sudo systemctl start postgresql
sudo systemctl enable postgresql
# Set password for the postgres user
sudo -u postgres psql -c "ALTER USER postgres PASSWORD 'password';"
```

**Windows:**
Download and install the PostgreSQL installer from [EnterpriseDB](https://www.enterprisedb.com/downloads/postgres-postgresql-downloads). Remember the password you set for the default `postgres` user during installation.

### LaTeX Installation

**Ubuntu/Debian:**
```bash
sudo apt-get update
sudo apt-get install texlive-full
```

**macOS:**
```bash
brew install --cask mactex
```

**Windows:**
Download and install MiKTeX from https://miktex.org/

## 🛠️ Installation

1. **Clone the repository:**
```bash
git clone <repository-url>
cd resume-builder
```

2. **Install backend dependencies:**
```bash
npm install
```

3. **Install frontend dependencies:**
```bash
npm run install:client
```

4. **Set up the local database:**
Create a new database named `resumebuilder`:
```bash
# On macOS / Linux
createdb -U postgres resumebuilder

# Or via psql terminal
psql -U postgres -c "CREATE DATABASE resumebuilder;"
```

5. **Set up environment variables:**
```bash
cp .env.example .env
```

Edit `.env` and add your configuration, pointing to your local PostgreSQL instance:
```env
# Database Configuration (Required)
# Format: postgresql://<user>:<password>@localhost:5432/<dbname>
DATABASE_URL=postgresql://postgres:password@localhost:5432/resumebuilder

# AI Configuration (Required)
ANTHROPIC_API_KEY=your_anthropic_api_key_here
ANTHROPIC_MODEL=claude-3-5-sonnet-20241022
OPENAI_TEMPERATURE=0.3
OPENAI_MAX_TOKENS=16000

# Server Configuration
PORT=3001
NODE_ENV=development

# LaTeX Configuration
LATEX_TIMEOUT=30000
LATEX_COMMAND=pdflatex
```

6. **Initialize the database schema:**
```bash
# Test local database connection
npm run db:test

# Run database setup/migrations to build required tables
npm run db:setup
```

7. **Build the frontend:**
```bash
npm run build:client
```

## 🚀 Usage

### Development Mode

**Option 1: Start both servers with a single command (Recommended):**
```bash
npm run dev:both
```

**Option 2: Start servers separately:**
```bash
# Terminal 1: Start the backend server
npm run dev:server

# Terminal 2: Start the frontend server
npm run dev:client
```

**Option 3: Individual commands:**
```bash
# Backend only
npm run dev

# Frontend only (in new terminal)
cd client && npm start
```

The application will be available at:
- Frontend: http://localhost:3000
- Backend API: http://localhost:3001

### Production Mode

**Option 1: Start both servers (Recommended):**
```bash
npm run start:both
```

**Option 2: Start backend only (serves built frontend):**
```bash
npm start
```

The application will be available at:
- Full Application: http://localhost:3001
- Frontend: http://localhost:3000 (if using start:both)
- Backend API: http://localhost:3001

## 📝 How It Works

1. **Input Job Description**: Paste the target job description into the application
2. **Choose Resume**: Use the default template or upload your own LaTeX resume
3. **Extract Keywords**: Optionally preview extracted keywords from the job description
4. **Tailor Resume**: Click "Tailor Resume" to process with AI
5. **Review & Download**: View the optimized LaTeX code and download the PDF

## 🔧 API Endpoints

### Core Endpoints
- `GET /api/health` - Health check with database status
- `GET /api/base-resume` - Get default resume template
- `POST /api/upload-resume` - Upload custom resume file
- `POST /api/extract-keywords` - Extract keywords from job description
- `POST /api/tailor-resume` - Main tailoring endpoint with full tracking
- `GET /api/download/:sessionId` - Download generated PDF with tracking

### Analytics Endpoints
- `GET /api/analytics/recent-sessions` - Get recent tailoring sessions
- `GET /api/analytics/keywords` - Get keyword usage analytics
- `GET /api/analytics/user/:email` - Get user dashboard data
- `GET /api/analytics/metrics` - Get system performance metrics
- `GET /api/sessions/:sessionId` - Get session details
- `POST /api/admin/cleanup` - Database cleanup

### Example API Usage

```javascript
// Tailor a resume
const response = await fetch('/api/tailor-resume', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    jobDescription: 'Software Engineer position...',
    customResume: '\\documentclass{article}...' // optional
  })
});

const result = await response.json();
// result.success, result.sessionId, result.revisedTex, result.pdfPath
```

## 📜 Available Scripts

### Combined Scripts (Recommended)
- `npm run start:both` - Start both frontend and backend servers in production mode
- `npm run dev:both` - Start both servers in development mode with hot reload

### Individual Scripts
- `npm run start:server` - Start backend server only
- `npm run start:client` - Start frontend client only
- `npm run dev:server` - Start backend with nodemon (hot reload)
- `npm run dev:client` - Start frontend with Vite dev server

### Build & Install Scripts
- `npm run install:all` - Install dependencies for both backend and frontend
- `npm run install:client` - Install frontend dependencies only
- `npm run build` - Build frontend for production
- `npm run build:client` - Build frontend (alias)

### Database Scripts
- `npm run db:test` - Test database configuration
- `npm run db:setup` - Set up database schema and initial data
- `npm run db:migrate` - Run database migrations

### Legacy Scripts
- `npm start` - Start backend server (legacy)
- `npm run dev` - Start backend with nodemon (legacy)

## 🧪 Testing

```bash
# Run backend tests
npm test

# Run frontend tests
cd client && npm test

# Run tests with watch mode
npm run test:watch
```

## 🛡️ LaTeX Security

The application validates LaTeX input to ensure:
- Proper document structure
- Balanced braces and environments
- UTF-8 encoding
- No malicious commands

## 📁 Project Structure

```
resume-builder/
├── server.js                 # Express server
├── package.json              # Backend dependencies
├── base_resume.tex           # Default resume template
├── src/modules/              # Backend modules
│   ├── ResumeIngestor.js
│   ├── JobDescriptionProcessor.js
│   ├── TailoringEngine.js
│   └── LaTeXCompiler.js
├── client/                   # React frontend
│   ├── package.json
│   ├── src/
│   │   ├── components/
│   │   ├── pages/
│   │   └── services/
│   └── public/
├── output/                   # Generated files
└── uploads/                  # Temporary uploads
```

## 🔒 Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `DATABASE_URL` | Local PostgreSQL connection string | Required |
| `ANTHROPIC_API_KEY` | Anthropic API key | Required |
| `ANTHROPIC_MODEL` | Model to use | `claude-3-5-sonnet-20241022` |
| `OPENAI_TEMPERATURE` | Creativity level | `0.3` |
| `OPENAI_MAX_TOKENS` | Max response tokens | `16000` |
| `PORT` | Server port | `3001` |
| `NODE_ENV` | Environment | `development` |
| `LATEX_TIMEOUT` | LaTeX compilation timeout | `30000` |
| `LATEX_COMMAND` | LaTeX command | `pdflatex` |

## 🚨 Troubleshooting

### Common Issues

**LaTeX not found:**
- Ensure LaTeX is installed and `pdflatex` is in your PATH
- On macOS, add `/usr/local/texlive/2023/bin/universal-darwin` to PATH

**API errors:**
- Verify your Anthropic/OpenAI API key is correct and has credits
- Check rate limits and quotas

**Compilation errors:**
- Ensure input LaTeX file is valid
- Check for missing packages in your LaTeX installation

**File upload issues:**
- Verify file is valid LaTeX (.tex extension)
- Check file size (max 5MB)

**Database connection issues:**
- Ensure your local PostgreSQL service is actively running (`sudo systemctl status postgresql` or `brew services info postgresql`).
- Test database configuration: `npm run db:test`
- Verify `DATABASE_URL` format: `postgresql://user:password@localhost:5432/resumebuilder`
- Confirm that the database (`resumebuilder`) actually exists using `psql -l` or pgAdmin.

### Debug Mode

Set `NODE_ENV=development` for detailed logging.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📜 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Anthropic & OpenAI for API access
- LaTeX community for excellent documentation
- React and Node.js communities

## 📞 Support

For support, please open an issue on the GitHub repository or contact the development team.

---

**Built with ❤️ using Node.js, React, and LLMs**
