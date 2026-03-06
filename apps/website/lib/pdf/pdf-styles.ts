import { StyleSheet } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    fontFamily: "Nunito Sans",
    fontSize: 10,
    paddingTop: 40,
    paddingBottom: 80,
    paddingHorizontal: 40,
    color: "#1e293b",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
    paddingBottom: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
  },
  nwLogo: {
    width: 133,
    height: 25,
  },
  companyLogo: {
    maxWidth: 120,
    maxHeight: 40,
    objectFit: "contain",
  },
  title: {
    fontFamily: "Lora",
    fontSize: 22,
    fontWeight: 500,
    marginBottom: 12,
    color: "#0f172a",
    lineHeight: 1.3,
  },
  abstract: {
    fontSize: 11,
    fontWeight: 300,
    lineHeight: 1.6,
    marginBottom: 12,
    color: "#334155",
  },
  tldrSection: {
    backgroundColor: "#e0f2fe",
    borderRadius: 4,
    padding: 14,
    marginBottom: 12,
  },
  tldrHeading: {
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 8,
    color: "#0f172a",
  },
  tldrItem: {
    fontSize: 10,
    lineHeight: 1.5,
    marginLeft: 8,
    marginBottom: 4,
    color: "#334155",
  },
  dateline: {
    fontSize: 9,
    color: "#64748b",
    marginBottom: 16,
  },
  pullquote: {
    borderLeftWidth: 3,
    borderLeftColor: "#0ea5e9",
    paddingLeft: 12,
    paddingVertical: 6,
    marginVertical: 14,
    marginHorizontal: 20,
  },
  pullquoteText: {
    fontSize: 12,
    fontWeight: 300,
    color: "#0f172a",
    lineHeight: 1.5,
  },
  newsImage: {
    width: "100%",
    maxHeight: 300,
    objectFit: "contain",
    marginVertical: 10,
    borderRadius: 4,
  },
  imageCaption: {
    fontSize: 8,
    color: "#64748b",
    textAlign: "center",
    marginBottom: 12,
  },
  bodyContainer: {
    marginVertical: 10,
  },
  sectionHeading: {
    fontSize: 12,
    fontWeight: 700,
    marginTop: 16,
    marginBottom: 4,
    color: "#0f172a",
  },
  divider: {
    borderBottomWidth: 1,
    borderBottomColor: "#e2e8f0",
    marginBottom: 8,
  },
  contactSection: {
    marginTop: 16,
  },
  contactName: {
    fontSize: 10,
    fontWeight: 600,
  },
  contactDetail: {
    fontSize: 9,
    color: "#475569",
  },
  companyInfoSection: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginTop: 20,
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
  },
  companyInfoLeft: {
    flex: 1,
    paddingRight: 20,
  },
  companyName: {
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 4,
    color: "#0f172a",
  },
  companyDetail: {
    fontSize: 9,
    color: "#0284c7",
    marginBottom: 2,
  },
  categoriesSection: {
    marginTop: 14,
  },
  qrCodeSection: {
    alignItems: "center",
    marginTop: 14,
  },
  qrCode: {
    width: 100,
    height: 100,
  },
  categoryPill: {
    fontSize: 8,
    color: "#475569",
    backgroundColor: "#f1f5f9",
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
    marginRight: 6,
    marginBottom: 4,
  },
  categoriesRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    marginTop: 4,
  },
  footer: {
    position: "absolute",
    bottom: 20,
    left: 40,
    right: 40,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderTopWidth: 1,
    borderTopColor: "#e2e8f0",
    paddingTop: 8,
  },
  footerText: {
    fontSize: 8,
    color: "#94a3b8",
  },
  footerUrl: {
    fontSize: 8,
    color: "#0284c7",
  },
});

export default styles;
