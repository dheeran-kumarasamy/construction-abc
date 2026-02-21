# Quick Start & Testing Guide

## 🚀 Start the Application

### Terminal 1: Backend
```bash
cd construction-app/backend
npm run dev
# Backend runs on http://localhost:4000
```

### Terminal 2: Frontend  
```bash
cd construction-app/frontend
npm run dev
# Frontend runs on http://localhost:5173
```

## 🧪 Test the Complete Workflow

### Step 1: Architect Login & Project Setup
1. Navigate to http://localhost:5173
2. Login as architect (create account if needed)
3. Create a new project (give it a name like "Office Complex A")
4. Upload a BOQ file (CSV with Item Name, Quantity, UOM columns)
5. Map BOQ columns if prompted
6. Confirm BOQ

### Step 2: Architect Invites Builder
1. Go to "Invite Builders" (in architect dashboard)
2. Enter builder email (e.g., `builder@example.com`)
3. Select the project you created
4. Click "Send Invite"
5. Copy the generated invite link

### Step 3: Builder Accepts Invite
1. **Open new incognito/private browser** (to avoid logged-in conflict)
2. Paste the invite link
3. Click "Accept Invite" 
4. Login/register as the builder (use the same email)
5. You should see the project in "Apply Base Pricing to Project"

### Step 4: Builder Applies Pricing
1. On "Apply Base Pricing to Project" page
2. Select the project from dropdown
3. BOQ items should auto-load
4. Click "Upload Base Pricing"
5. Upload a CSV with columns: Item Name, Rate, UOM
   - Example CSV:
     ```
     Concrete,500,per_cu_m
     Rebar,30000,per_tonne
     Bricks,12,per_piece
     ```
6. Items auto-match to BOQ (based on names)
7. Enter margin percentage (e.g., 15)
8. Click "Submit Estimate"
9. See success message

### Step 5: Architect Views Submitted Estimate
1. **Switch back to architect browser**
2. Go to "Received Estimates"
3. Select the same project from dropdown
4. You should see the builder's estimate with:
   - Builder name
   - Grand total (₹ formatted)
   - Submission time
   - Lowest bid highlighted in green

### Step 6: Architect Compares & Awards
1. Go to "Comparison Dashboard"
2. Select the project from dropdown
3. See ranked comparison with builder bids
4. Rank #1 (lowest) highlighted in green with "Award" button
5. Click "Award" to select the lowest bidder
6. Confirm in dialog
7. Success message

## 📊 Expected Results

✅ Builder sees only the ONE project they were invited to (not all projects)
✅ Estimate submitted with full pricing snapshot
✅ Architect sees submitted estimate in real-time
✅ Architect can compare multiple builder bids
✅ Lowest bid correctly marked and awardable

## 🔍 Database Verification (Optional)

If you want to verify data in PostgreSQL:

```sql
-- Check invite was created and accepted
SELECT user_id, project_id, accepted_at 
FROM user_invites 
WHERE organization_id = 'your-org-id';

-- Check estimate was submitted
SELECT id, project_id, status, submitted_at 
FROM estimates 
WHERE status = 'submitted';

-- Check estimate revision with pricing
SELECT estimate_id, pricing_snapshot 
FROM estimate_revisions 
LIMIT 1;
```

## 🐛 Debugging Tips

### If builder doesn't see the project:
- Verify `user_invites.accepted_at` is NOT NULL in database
- Check accept-invite endpoint was called (check auth logs)

### If estimate submission fails:
- Check builder has valid JWT token
- Verify project_id matches invitation
- Check base pricing CSV has correct columns

### If architect doesn't see estimate:
- Verify estimate `status = 'submitted'`
- Check project_id selection matches
- Refresh page to trigger new fetch

### Logs:
- Backend logs: Terminal showing `npm run dev` output
- Frontend logs: Browser DevTools Console (F12)

## 📱 Browser Tips

- Clear localStorage if seeing stale data: 
  ```javascript
  localStorage.clear()
  ```
- Use different **browsers** or **incognito** windows to simulate multiple users

## ✨ Key Features to Verify

- [ ] Invite is project-specific (builder doesn't see other projects)
- [ ] Estimate pricing auto-calculates with margin
- [ ] Grand total = (Item 1 Rate + Item 2 Rate + ...) × (1 + Margin%)
- [ ] Architect sees submission time in local timezone
- [ ] Comparison rankings are correct (lowest first)
- [ ] Award button works without errors

---

**Everything should work end-to-end!** If you hit issues, check the backend/frontend console output for error messages.
