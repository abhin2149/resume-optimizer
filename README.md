# Resume Optimizer - AI Tailoring Engine Prototype

## Overview
This prototype isolates the core AI orchestration engine of a larger Resume Builder project and wraps it in a React frontend for easy testing. It takes a master LaTeX resume and a plain-text Job Description, extracts semantic requirements, safely injects them into the LaTeX document using strict character-limits, and compiles a tailored PDF. 

**Note on Scope:** The Supabase database persistence layer has been deferred for this case study. The prototype relies strictly on local filesystem I/O so you can run the full-stack application immediately without provisioning external databases.

## Dependencies
* Node.js (v16+)
* A local LaTeX distribution (TeX Live, MacTeX, or MiKTeX) to run `pdflatex`
* An Anthropic API Key (or OpenAI API Key)

## Setup Instructions
1. Clone this directory and navigate to the root.
2. Run `npm run install:all` to install both backend and frontend dependencies.
3. Create a `.env` file in the root directory: (ANTHROPIC_API_KEY, ANTHROPIC_MODEL, LATEX_COMMAND=pdflatex, PORT=3001)

## Run Instructions
1. Run `npm run dev:both` from the root directory. This uses `concurrently` to start both the Express backend and the React frontend simultaneously.
2. Navigate to `http://localhost:3000` in your browser.
3. The output PDFs and raw LaTeX files will be generated in the `/output` directory.

## Sample Data & Expected Output
**Input 1 (Happy Path):** 
* Load `sample_data/base_resume.tex` (Software Engineer profile).
* Paste `sample_data/sample_jd.txt` (Founding Engineer JD requiring "0-to-1 architecture").
* **Expected Output:** The UI will display a loading state. Once complete, it will render the extracted keywords and allow you to download a perfectly formatted PDF where the bullets have been rewritten to match the 0-to-1 verbiage.

**Input 2 (Invalid Input Guardrail):** 
* Load `sample_data/base_resume.tex` (Software Engineer profile).
* Paste `sample_data/invalid_jd.txt` (Registered Nurse JD).
* **Expected Output:** The engine will detect a semantic mismatch. The UI will gracefully surface the error: `Semantic gap too wide. No relevant technical experience found.` No PDF will be generated, proving the system prevents fabricated credentials.
