import express from 'express';
import {
    createFeeStructure,
    getFeeStructures,
    assignFeesToClass,
    getStudentFees,
    getAllStudentFees,
    recordPayment,
    getPaymentHistory,
    deleteFeeStructure,
    updateFeeStructure,
    getFeeStructureById
} from '../controllers/feeController';

const router = express.Router();

// Fee Structures
router.post('/structure', createFeeStructure);
// Fee Structures
router.post('/structure', createFeeStructure);
router.get('/structure/:organizationId', getFeeStructures); // List
router.get('/structure/details/:id', getFeeStructureById); // Single item - using /details/:id to avoid collision if IDs overlap with orgIds (though MongoIDs are unique, express routing might be ambiguous if parameters are same regex. However, :organizationId usually captures everything. To be safe, let's use a distinct path or place specific routes BEFORE generic ones)
// Actually, 'structure/:organizationId' and 'structure/:id' are identical patterns.
// If I use 'structure/:id' it will conflict.
// Strategy: check if the param is an OrgId or StructureId? No, that's messy.
// Frontend uses: GET /structure/:orgId for list.
// Frontend uses: PUT /structure/:id for update.
// Frontend uses: DELETE /structure/:id for delete.
//
// The collision is real for GET.
// POST /structure (create) - OK
// GET /structure/:organizationId (list) - OK
// PUT /structure/:id (update) - OK (different method)
// DELETE /structure/:id (delete) - OK (different method)
//
// If I want GET /structure/:id (single), I CANNOT use that path because it matches GET /structure/:organizationId.
//
// Solution:
// 1. Keep list as is.
// 2. Add GET /structure/item/:id for single item?
// OR
// 3. Rename list to /structure/organization/:organizationId ? (Breaking change for frontend)
//
// Given frontend is `api.get('/fees/structure/${currentOrganizationId}')`, changing list route breaks frontend.
// So I must put the single item route on a different path, e.g. /structure/by-id/:id
// OR checking query params?
//
// Wait. `PUT` and `DELETE` don't collide with `GET` list.
// But the user's "Not Found" error when visiting in browser (GET /structure/ID) is because it hits `getFeeStructures` (list) which takes the ID as `organizationId` and returns empty list [] (200 OK) or if the ID format is wrong it implies...
// Wait, why did they get 404?
// If they hit `GET /structure/694...` it matches `router.get('/structure/:organizationId', getFeeStructures);`
// `getFeeStructures` runs `FeeStructure.find({ organizationId: '694...' })`.
// This returns `[]` (empty array). It defaults to 200 OK.
// So why did they see 404?
// User said: `{"message": "Not Found - /api/fees/structure/694eaab002fd47dc8d61454d"}`
// This standard 404 message comes from `notFound` middleware.
// This means NO route matched.
//
// Ah! `router.get('/structure/:organizationId', ...)`
// Maybe their ID `694eaab002fd47dc8d61454d` is valid.
//
// Wait, I see my previous `feeRoutes.ts` content:
// 16: router.get('/structure/:organizationId', getFeeStructures);
//
// If I curl'd it earlier and got 401, the route EXISTS.
// (401 means auth middleware hit, so route matched).
//
// So why did user get 404?
// Maybe they used a method that didn't exist? (PUT?)
// Yes, probable.
//
// So adding PUT /structure/:id is safe.
// Adding GET /structure/:id (single) is IMPOSSIBLE at the same path because of collision with list.
// I will add PUT /structure/:id.
// I will NOT add GET /structure/:id unless I namespace it (e.g. /structure/detail/:id).
// I'll add /structure/detail/:id just in case.

router.get('/structure/detail/:id', getFeeStructureById);
router.put('/structure/:id', updateFeeStructure);
router.delete('/structure/:id', deleteFeeStructure);

// Fee Assignment
router.post('/assign', assignFeesToClass);

// Student Fees (Individual & Admin View)
router.get('/student/:studentId', getStudentFees);
router.get('/organization/:organizationId', getAllStudentFees);

// Payments
router.post('/payment', recordPayment);
router.get('/payments', getPaymentHistory);

export default router;
