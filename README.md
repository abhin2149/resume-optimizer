# Resume Optimizer - AI Tailoring Engine Prototype

## Overview
This prototype isolates the backend AI orchestration engine of a larger Resume Builder project. It takes a master LaTeX resume and a plain-text Job Description, extracts semantic requirements, safely injects them into the LaTeX document using strict character-limits, and compiles a tailored PDF. 

**Note on Scope:** The React frontend and Supabase DB layers from the full repository have been stripped/deferred in this submission so you can run the core AI logic locally via a simple script within minutes.

## Dependencies
* Node.js (v16+)
* A local LaTeX distribution (TeX Live, MacTeX, or MiKTeX) to run `pdflatex`
* An Anthropic API Key (or OpenAI API Key)

## Setup Instructions
1. Clone this directory and navigate to the root.
2. Run `npm install` to install dependencies (express, @anthropic-ai/sdk, fs-extra).
3. Create a `.env` file in the root directory and add the required env variables (ANTHROPIC_API_KEY, ANTHROPIC_MODEL, LATEX_COMMAND=pdflatex)

## Run Instructions
To run the prototype against the sample data:
1. Run `node test_runner.js` (or start the express server via `node server.js` and use Postman).
2. The script will ingest `sample_data/base_resume.tex` and `sample_data/sample_jd.txt`.
3. Check the console output to view the orchestration steps (Extraction -> Budgeting -> Replacement -> Validation -> Compilation).
4. The output will be generated in the `/output` directory.

## Sample Data & Expected Output
**Input 1 (Happy Path):** 
* `base_resume.tex` (Software Engineer profile)
* `sample_jd.txt` (Founding Engineer JD requiring "0-to-1 architecture" and "LLM orchestration").
* **Expected Output:** The console will display the extracted keywords. The resulting `resume_output.pdf` will contain rewritten bullets matching the 0-to-1 verbiage, and the formatting will remain perfectly intact.

**Input 2 (Invalid Input Guardrail):** 
* `base_resume.tex` (Software Engineer profile)
* `invalid_jd.txt` (Registered Nurse JD).
* **Expected Output:** The engine will detect a semantic mismatch during the extraction phase and log: `Error: Semantic gap too wide. No relevant technical experience found.` No PDF will be generated, proving the system prevents fabricated credentials.
