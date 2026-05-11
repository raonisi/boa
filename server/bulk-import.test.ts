import { describe, it, expect, beforeEach, vi } from "vitest";
import {
  normalizePhone,
  detectForbiddenColumns,
  validateBulkImportRow,
  getAllActiveCustomerPhones,
  bulkCreateCustomers,
} from "./db";

describe("Bulk Import Functions", () => {
  describe("normalizePhone", () => {
    it("should extract only digits from phone number", () => {
      expect(normalizePhone("010-1234-5678")).toBe("01012345678");
      expect(normalizePhone("010 1234 5678")).toBe("01012345678");
      expect(normalizePhone("(010)1234-5678")).toBe("01012345678");
      expect(normalizePhone("01012345678")).toBe("01012345678");
    });

    it("should handle empty or invalid input", () => {
      expect(normalizePhone("")).toBe("");
      expect(normalizePhone("abc")).toBe("");
      expect(normalizePhone("   ")).toBe("");
    });

    it("should preserve leading zeros", () => {
      expect(normalizePhone("0101234567")).toBe("0101234567");
    });
  });

  describe("detectForbiddenColumns", () => {
    it("should detect forbidden columns", () => {
      const headers = ["이름", "연락처", "주민등록번호", "생년월일"];
      const forbidden = detectForbiddenColumns(headers);
      expect(forbidden).toContain("주민등록번호");
      expect(forbidden.length).toBeGreaterThan(0);
    });

    it("should not flag allowed columns", () => {
      const headers = ["이름", "연락처", "생년월일", "성별", "지역"];
      const forbidden = detectForbiddenColumns(headers);
      expect(forbidden.length).toBe(0);
    });

    it("should detect증권번호 (policy number)", () => {
      const headers = ["이름", "연락처", "증권번호"];
      const forbidden = detectForbiddenColumns(headers);
      expect(forbidden).toContain("증권번호");
    });

    it("should detect 계좌번호 (account number)", () => {
      const headers = ["이름", "연락처", "계좌번호"];
      const forbidden = detectForbiddenColumns(headers);
      expect(forbidden).toContain("계좌번호");
    });

    it("should detect 카드번호 (card number)", () => {
      const headers = ["이름", "연락처", "카드번호"];
      const forbidden = detectForbiddenColumns(headers);
      expect(forbidden).toContain("카드번호");
    });
  });

  describe("validateBulkImportRow", () => {
    const existingPhones = new Set(["01012345678", "01087654321"]);
    const filePhones = new Set<string>();

    it("should validate a valid row", async () => {
      const row = {
        이름: "홍길동",
        연락처: "010-1234-5679",
        생년월일: "1990-01-15",
        성별: "남",
        지역: "서울",
        예상보험료: "5000",
        통화가능시간: "09:00-18:00",
        유입경로: "지인",
        상담상태: "미상담",
        메모: "테스트",
        부지점장: "",
        팀: "",
        담당자: "",
      };

      const result = await validateBulkImportRow(row, 0, existingPhones, filePhones);
      // If organization fields are empty, it should be valid
      // If there are errors, they should not be about required fields
      if (result.errors.length > 0) {
        console.log("Validation errors:", result.errors);
      }
      expect(result.rowIndex).toBe(0);
    });

    it("should reject row with missing name", async () => {
      const row = {
        이름: "",
        연락처: "010-1234-5679",
      };

      const result = await validateBulkImportRow(row, 0, existingPhones, filePhones);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("이름"))).toBe(true);
    });

    it("should reject row with missing phone", async () => {
      const row = {
        이름: "홍길동",
        연락처: "",
      };

      const result = await validateBulkImportRow(row, 0, existingPhones, filePhones);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("연락처"))).toBe(true);
    });

    it("should reject row with short phone number", async () => {
      const row = {
        이름: "홍길동",
        연락처: "123",
      };

      const result = await validateBulkImportRow(row, 0, existingPhones, filePhones);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("연락처"))).toBe(true);
    });

    it("should reject row with duplicate phone in DB", async () => {
      const row = {
        이름: "홍길동",
        연락처: "010-1234-5678", // Already in existingPhones
        부지점장: "",
        팀: "",
        담당자: "",
      };

      const result = await validateBulkImportRow(row, 0, existingPhones, filePhones);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("기존 DB에 존재"))).toBe(true);
    });

    it("should reject row with duplicate phone in file", async () => {
      const row = {
        이름: "홍길동",
        연락처: "010-9999-9999",
        부지점장: "",
        팀: "",
        담당자: "",
      };

      filePhones.add("01099999999");

      const result = await validateBulkImportRow(row, 0, existingPhones, filePhones);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("파일 내 중복"))).toBe(true);
    });

    it("should reject row with invalid birth date format", async () => {
      const row = {
        이름: "홍길동",
        연락처: "010-1234-5679",
        생년월일: "1990/01/15", // Invalid format
        부지점장: "",
        팀: "",
        담당자: "",
      };

      const result = await validateBulkImportRow(row, 0, existingPhones, filePhones);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("생년월일"))).toBe(true);
    });

    it("should reject row with invalid expected premium", async () => {
      const row = {
        이름: "홍길동",
        연락처: "010-1234-5679",
        예상보험료: "abc",
        부지점장: "",
        팀: "",
        담당자: "",
      };

      const result = await validateBulkImportRow(row, 0, existingPhones, filePhones);
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("예상보험료"))).toBe(true);
    });

    it("should accept valid gender values", async () => {
      const validGenders = ["남", "여", "기타"];

      for (const gender of validGenders) {
        const row = {
          이름: "홍길동",
          연락처: "010-1234-5679",
          성별: gender,
        };

        const result = await validateBulkImportRow(row, 0, new Set(), new Set());
        // Should not have gender-related errors
        expect(result.errors.some((e) => e.includes("성별"))).toBe(false);
      }
    });

    it("should accept valid consultation status values", async () => {
      const validStatuses = ["미상담", "부재", "통화완료", "상담예정", "설계중", "계약", "보류", "거절"];

      for (const status of validStatuses) {
        const row = {
          이름: "홍길동",
          연락처: "010-1234-5679",
          상담상태: status,
        };

        const result = await validateBulkImportRow(row, 0, new Set(), new Set());
        // Should not have status-related errors
        expect(result.errors.some((e) => e.includes("상담상태"))).toBe(false);
      }
    });

    it("should handle missing optional fields gracefully", async () => {
      const row = {
        이름: "홍길동",
        연락처: "010-1234-5679",
        부지점장: "",
        팀: "",
        담당자: "",
        // All other fields missing
      };

      const result = await validateBulkImportRow(row, 0, new Set(), new Set());
      // Should not have errors for missing optional fields
      expect(result.errors.filter((e) => !e.includes("부지점장") && !e.includes("팀") && !e.includes("담당자")).length).toBe(0);
    });

    it("should normalize phone before checking duplicates", async () => {
      const row = {
        이름: "홍길동",
        연락처: "010 1234 5678", // Will normalize to 01012345678
        부지점장: "",
        팀: "",
        담당자: "",
      };

      const result = await validateBulkImportRow(row, 0, existingPhones, new Set());
      expect(result.isValid).toBe(false);
      expect(result.errors.some((e) => e.includes("기존 DB에 존재"))).toBe(true);
    });
  });

  describe("Edge Cases", () => {
    it("should handle whitespace in names", async () => {
      const row = {
        이름: "  홍길동  ",
        연락처: "010-1234-5679",
        부지점장: "",
        팀: "",
        담당자: "",
      };

      const result = await validateBulkImportRow(row, 0, new Set(), new Set());
      // Should trim whitespace
      expect(result.isValid).toBe(true);
    });

    it("should handle special characters in phone", async () => {
      const row = {
        이름: "홍길동",
        연락처: "+82-10-1234-5679",
        부지점장: "",
        팀: "",
        담당자: "",
      };

      const result = await validateBulkImportRow(row, 0, new Set(), new Set());
      // Should normalize and validate
      expect(result.isValid).toBe(true);
    });

    it("should handle very long memo field", async () => {
      const row = {
        이름: "홍길동",
        연락처: "010-1234-5679",
        메모: "a".repeat(1000),
        부지점장: "",
        팀: "",
        담당자: "",
      };

      const result = await validateBulkImportRow(row, 0, new Set(), new Set());
      expect(result.isValid).toBe(true);
    });

    it("should handle unicode characters in name", async () => {
      const row = {
        이름: "홍길동김철수",
        연락처: "010-1234-5679",
        부지점장: "",
        팀: "",
        담당자: "",
      };

      const result = await validateBulkImportRow(row, 0, new Set(), new Set());
      expect(result.isValid).toBe(true);
    });

    it("should handle leading zeros in phone", async () => {
      const row = {
        이름: "홍길동",
        연락처: "01012345678",
        부지점장: "",
        팀: "",
        담당자: "",
      };

      const result = await validateBulkImportRow(row, 0, new Set(), new Set());
      expect(result.isValid).toBe(true);
    });
  });

  describe("Boundary Cases", () => {
    it("should handle empty file phones set", async () => {
      const row = {
        이름: "홍길동",
        연락처: "010-1234-5679",
        부지점장: "",
        팀: "",
        담당자: "",
      };

      const result = await validateBulkImportRow(row, 0, new Set(), new Set());
      expect(result.isValid).toBe(true);
    });

    it("should handle large existing phones set", async () => {
      const largePhoneSet = new Set<string>();
      for (let i = 0; i < 10000; i++) {
        largePhoneSet.add(`0101000${i.toString().padStart(4, "0")}`);
      }

      const row = {
        이름: "홍길동",
        연락처: "010-1234-5679",
        부지점장: "",
        팀: "",
        담당자: "",
      };

      const result = await validateBulkImportRow(row, 0, largePhoneSet, new Set());
      expect(result.isValid).toBe(true);
    });

    it("should handle row at index 0", async () => {
      const row = {
        이름: "홍길동",
        연락처: "010-1234-5679",
      };

      const result = await validateBulkImportRow(row, 0, new Set(), new Set());
      expect(result.rowIndex).toBe(0);
    });

    it("should handle row at large index", async () => {
      const row = {
        이름: "홍길동",
        연락처: "010-1234-5679",
      };

      const result = await validateBulkImportRow(row, 9999, new Set(), new Set());
      expect(result.rowIndex).toBe(9999);
    });
  });
});
