// Bulk Import Routers - To be inserted into customers router in routers.ts

export const bulkImportRouters = `
    downloadImportTemplate: branchAdminProcedure.query(async ({ ctx }) => {
      const headers = [
        "이름",
        "연락처",
        "생년월일",
        "성별",
        "지역",
        "예상보험료",
        "통화가능시간",
        "유입경로",
        "상담상태",
        "메모",
        "부지점장",
        "팀",
        "담당자",
      ];
      const csvContent = headers.join(",");
      await log(ctx.user.id, "DATA_DOWNLOAD", "template", undefined, "type=bulk_import_template");
      return { headers, csvContent };
    }),

    previewImport: branchAdminProcedure
      .input(z.object({
        rows: z.array(z.record(z.string(), z.any())),
      }))
      .mutation(async ({ ctx, input }) => {
        const headers = Object.keys(input.rows[0] || {});
        const forbiddenCols = detectForbiddenColumns(headers);
        if (forbiddenCols.length > 0) {
          await log(ctx.user.id, "CUSTOMER_BULK_IMPORT_FAILED", "customer", undefined,
            JSON.stringify({ reason: "forbidden_columns", forbiddenColumns: forbiddenCols, fileName: "preview" }));
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: \`금지된 컬럼이 포함되어 있습니다: \${forbiddenCols.join(", ")}. 민감정보(주민번호, 증권번호 등)는 업로드할 수 없습니다.\`,
          });
        }

        const existingPhones = await getAllActiveCustomerPhones();
        const filePhones = new Set<string>();

        const validationResults: BulkImportValidationResult[] = [];
        for (let i = 0; i < input.rows.length; i++) {
          const row = input.rows[i] as BulkImportRow;
          const result = await validateBulkImportRow(row, i, existingPhones, filePhones);
          validationResults.push(result);
        }

        const successCount = validationResults.filter((r) => r.isValid).length;
        const errorCount = validationResults.filter((r) => !r.isValid).length;

        await log(ctx.user.id, "CUSTOMER_BULK_IMPORT_PREVIEWED", "customer", undefined,
          JSON.stringify({ totalRows: input.rows.length, successRows: successCount, failedRows: errorCount }));

        return {
          totalRows: input.rows.length,
          successRows: successCount,
          failedRows: errorCount,
          validationResults,
        };
      }),

    bulkImport: branchAdminProcedure
      .input(z.object({
        rows: z.array(z.record(z.string(), z.any())),
        fileName: z.string().optional(),
      }))
      .mutation(async ({ ctx, input }) => {
        const importBatchId = \`batch_\${Date.now()}_\${Math.random().toString(36).slice(2, 9)}\`;

        const headers = Object.keys(input.rows[0] || {});
        const forbiddenCols = detectForbiddenColumns(headers);
        if (forbiddenCols.length > 0) {
          await log(ctx.user.id, "CUSTOMER_BULK_IMPORT_FAILED", "customer", undefined,
            JSON.stringify({ importBatchId, reason: "forbidden_columns", forbiddenColumns: forbiddenCols, fileName: input.fileName }));
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: \`금지된 컬럼이 포함되어 있습니다: \${forbiddenCols.join(", ")}\`,
          });
        }

        const existingPhones = await getAllActiveCustomerPhones();
        const filePhones = new Set<string>();

        const validationResults: BulkImportValidationResult[] = [];
        for (let i = 0; i < input.rows.length; i++) {
          const row = input.rows[i] as BulkImportRow;
          const result = await validateBulkImportRow(row, i, existingPhones, filePhones);
          validationResults.push(result);
        }

        const validRows = validationResults.filter((r) => r.isValid);
        if (validRows.length === 0) {
          await log(ctx.user.id, "CUSTOMER_BULK_IMPORT_FAILED", "customer", undefined,
            JSON.stringify({ importBatchId, reason: "no_valid_rows", totalRows: input.rows.length, fileName: input.fileName }));
          throw new TRPCError({
            code: "BAD_REQUEST",
            message: "유효한 행이 없습니다. 모든 행에 오류가 있습니다.",
          });
        }

        const customersToCreate = validRows.map((result) => {
          const row = input.rows[result.rowIndex] as BulkImportRow;
          return {
            name: row.name!,
            phone: row.phone,
            birthDate: row.birthDate ? new Date(row.birthDate) : undefined,
            gender: (row.gender === "남" ? "male" : row.gender === "여" ? "female" : row.gender === "other" ? "other" : undefined) as any,
            region: row.region,
            expectedPremium: row.expectedPremium ? parseInt(row.expectedPremium, 10) : undefined,
            availableTime: row.availableTime,
            source: row.source,
            consultStatus: row.consultStatus || "미상담",
            memo: row.memo,
            agentId: result.agentId,
            subBranchAdminId: result.subBranchAdminId,
            assignedTeamId: result.teamId,
            assignmentStatus: result.assignmentStatus,
            createdBy: ctx.user.id,
          };
        });

        await bulkCreateCustomers(customersToCreate);

        const errorCount = validationResults.filter((r) => !r.isValid).length;
        const duplicateCount = validationResults.filter((r) => r.errors.some((e) => e.includes("기존 DB에 존재"))).length;

        await log(ctx.user.id, "CUSTOMER_BULK_IMPORTED", "customer", undefined,
          JSON.stringify({
            importBatchId,
            fileName: input.fileName,
            uploadedBy: ctx.user.id,
            totalRows: input.rows.length,
            successRows: validRows.length,
            failedRows: errorCount,
            duplicateRows: duplicateCount,
            importedAt: new Date().toISOString(),
          }));

        await log(ctx.user.id, "DATA_IMPORT", "customers", undefined,
          JSON.stringify({
            importBatchId,
            fileName: input.fileName,
            type: "bulk_import",
            successRows: validRows.length,
          }));

        return {
          success: true,
          importBatchId,
          totalRows: input.rows.length,
          successRows: validRows.length,
          failedRows: errorCount,
          duplicateRows: duplicateCount,
          validationResults,
        };
      }),
`;
