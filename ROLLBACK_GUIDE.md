# 🎯 ROLLBACK GUIDE - STABLE PRODUCTION

## 📍 MOST STABLE COMMIT: `478e16f`
**Tag:** `STABLE-PRODUCTION-v1.0`

## ✅ WHAT WORKS IN THIS COMMIT:
- ✅ **Shipping Calculation**: Origin 2425 → Customer Address (Banjarmasin → Cililin = Rp 28,000)
- ✅ **Address Dropdowns**: Province → City → District → Subdistrict
- ✅ **RajaOngkir API**: Komerce integration working
- ✅ **Firebase**: Firestore & Storage fully functional
- ✅ **Authentication**: User login/register working
- ✅ **Payment System**: Base64 payment proof system
- ✅ **Debug Logging**: Console tracking enabled

## 🚨 EMERGENCY ROLLBACK COMMANDS:

### Option 1: Hard Reset (Recommended for emergencies)
```bash
git reset --hard STABLE-PRODUCTION-v1.0
git push origin main --force
```

### Option 2: Soft Reset (Keeps local changes)
```bash
git reset --soft STABLE-PRODUCTION-v1.0
git commit -m "Rollback to stable production"
git push origin main
```

### Option 3: Using Commit Hash
```bash
git reset --hard 478e16f
git push origin main --force
```

## 🔍 VERIFY ROLLBACK:
```bash
# Check you're on the right commit
git log --oneline -1
# Should show: 478e16f 🔧 FIX: Shipping destination now uses customer address

# Check deployment status
vercel logs --limit 5
```

## ⚠️  WHEN TO ROLLBACK:
- Shipping costs showing wrong values (Rp 32,000 instead of Rp 28,000)
- Address dropdowns not working
- API endpoints returning errors
- Firebase connection issues
- Payment system not working

## 📞 ROLLBACK VERIFICATION:
After rollback, test these:
1. **Shipping**: Banjarmasin → Cililin should be Rp 28,000
2. **Address**: All dropdown levels should work
3. **Checkout**: Full checkout process should complete
4. **Console**: Debug logging should show correct API calls

---
**🎯 THIS IS YOUR SAFE POINT - Tag created on 2025-10-30**
**🤖 Generated with Claude Code**