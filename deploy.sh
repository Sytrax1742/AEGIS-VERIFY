#!/bin/bash

# ANSI Colors for btop-style UI
C='\033[36m'   # Cyan
M='\033[35m'   # Magenta
G='\033[32m'   # Green
Y='\033[33m'   # Yellow
R='\033[31m'   # Red
D='\033[90m'   # Gray
NC='\033[0m'   # No Color
B='\033[1m'    # Bold

draw_menu() {
  clear
  echo -e "${C}╭──────────────────────────────────────────────────────────╮${NC}"
  echo -e "${C}│${NC}  ${B}🛡️  AEGIS-VERIFY :: DEPLOYMENT COMMANDER v2.0${NC}           ${C}│${NC}"
  echo -e "${C}├──────────────────────────────────────────────────────────┤${NC}"
  echo -e "${C}│${NC}  ${D}Select target architecture to provision:${NC}                ${C}│${NC}"
  echo -e "${C}│${NC}                                                          ${C}│${NC}"
  echo -e "${C}│${NC}[${Y}1${NC}] ${M}🌐 Vercel${NC}       (Frontend UI)                       ${C}│${NC}"
  echo -e "${C}│${NC}  [${Y}2${NC}] ${C}☁️  Cloud Run${NC}    (Backend Engine)                    ${C}│${NC}"
  echo -e "${C}│${NC}  [${Y}3${NC}] ${G}🚀 SYNC${NC}          (Split-Screen Dual Deploy)          ${C}│${NC}"
  echo -e "${C}│${NC}  [${Y}4${NC}] ${R}❌ Abort${NC}         (Exit)                              ${C}│${NC}"
  echo -e "${C}╰──────────────────────────────────────────────────────────╯${NC}"
  echo ""
}

deploy_frontend() {
  echo -e "${M}╭── [ 🌐 FRONTEND DEPLOYMENT ] ─────────────────────────╮${NC}"
  cd frontend || exit
  npx vercel --prod --yes
  echo -e "${M}╰───────────────────────────────────────────────────────╯${NC}"
}

deploy_backend() {
  echo -e "${C}╭── [ ☁️  BACKEND DEPLOYMENT ] ──────────────────────────╮${NC}"
  cd backend || exit
  gcloud run deploy aegis-backend \
    --source . \
    --region us-central1 \
    --allow-unauthenticated \
    --memory 1Gi \
    --set-env-vars GCP_PROJECT_ID="aegis-verify-2026",GCP_REGION="us-central1",CORS_ORIGINS="*"
  echo -e "${C}╰───────────────────────────────────────────────────────╯${NC}"
}

draw_menu
read -p "  Enter your choice [1-4]: " choice
echo ""

case "$choice" in
  1)
    deploy_frontend
    ;;
  2)
    deploy_backend
    ;;
  3)
    if command -v tmux &> /dev/null; then
        echo -e "${G}🚀 Launching btop-style split screen via tmux...${NC}"
        sleep 1
        # Create a new tmux session detached
        tmux new-session -d -s deploy_session "echo -e '\033[35m[ 🌐 VERCEL DEPLOYMENT ]\033[0m'; cd frontend && npx vercel --prod --yes; echo ''; read -p 'Frontend deployed. Press Enter to close pane...'"
        # Split it horizontally
        tmux split-window -h "echo -e '\033[36m[ ☁️  GCP CLOUD RUN DEPLOYMENT ]\033[0m'; cd backend && gcloud run deploy aegis-backend --source . --region us-central1 --allow-unauthenticated --memory 1Gi --set-env-vars GCP_PROJECT_ID=aegis-verify-2026,GCP_REGION=us-central1,CORS_ORIGINS='*'; echo ''; read -p 'Backend deployed. Press Enter to close pane...'"
        # Attach to the session
        tmux attach-session -t deploy_session
    else
        echo -e "${Y}⚠️  'tmux' not found! Falling back to interleaved colored dashboard...${NC}"
        echo -e "${G}🚀 INITIATING GLOBAL DEPLOYMENT...${NC}"
        echo ""
        
        # Multiplexer fallback: adds colored tags to the start of every terminal log line
        (
          cd frontend || exit
          npx vercel --prod --yes 2>&1 | sed -e "s/^/${M}[🌐 FRONTEND]${NC} /"
        ) &
        
        (
          cd backend || exit
          gcloud run deploy aegis-backend \
            --source . \
            --region us-central1 \
            --allow-unauthenticated \
            --memory 1Gi \
            --set-env-vars GCP_PROJECT_ID="aegis-verify-2026",GCP_REGION="us-central1",CORS_ORIGINS="*" 2>&1 | sed -e "s/^/${C}[☁️  BACKEND ]${NC} /"
        ) &
        
        wait
        echo ""
        echo -e "${G}╭──────────────────────────────────────────────────────────╮${NC}"
        echo -e "${G}│ 🎉 ALL SYSTEMS GO. AEGIS-VERIFY IS LIVE.                 │${NC}"
        echo -e "${G}╰──────────────────────────────────────────────────────────╯${NC}"
    fi
    ;;
  4)
    echo -e "${D}Aborting deployment.${NC}"
    exit 0
    ;;
  *)
    echo -e "${R}❌ Invalid choice. Aborting.${NC}"
    exit 1
    ;;
esac
