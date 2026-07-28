// station-piscicole-export.service.ts
// Exports côté client : Excel (SheetJS), CSV (BOM + ';'), JSON, PDF (pdfMake)
// Dépendances : npm install xlsx pdfmake
import { Injectable } from "@angular/core";
import * as XLSX from "xlsx";
import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

import {
  StationPiscicole,
  TYPE_STATION_LABELS,
  SOURCE_EAU_LABELS,
  TYPE_PROMOTEUR_LABELS,
  STATUT_STATION_LABELS,
} from "../../models/stations-piscicole.model";

// Enregistrement du VFS des polices (évite l'erreur "Roboto not found")
(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).vfs;

@Injectable({ providedIn: "root" })
export class StationPiscicoleExportService {
  // -------------------------------------------------------------------------
  // Construction des lignes exportables (mêmes en-têtes que le modèle d'import
  // backend -> un export Excel peut être réimporté tel quel)
  // -------------------------------------------------------------------------

  private construireLignes(
    stations: StationPiscicole[],
  ): Record<string, any>[] {
    return stations.map((s) => ({
      Code: s.code_station,
      Nom: s.nom,
      Province: s.province,
      Département: s.departement || "",
      Localité: s.localite || "",
      Adresse: s.adresse || "",
      Latitude: s.latitude ?? "",
      Longitude: s.longitude ?? "",
      "Type de station": TYPE_STATION_LABELS[s.type_station] || s.type_station,
      "Superficie (m²)": s.superficie_totale ?? "",
      "Nombre de bassins": s.nombre_bassins ?? "",
      "Capacité (t/an)": s.capacite_production ?? "",
      "Source d'eau": s.source_eau ? SOURCE_EAU_LABELS[s.source_eau] : "",
      Espèces: s.especes_elevees ? s.especes_elevees.split(",").join(", ") : "",
      Promoteur: s.promoteur_nom,
      "Contact promoteur": s.promoteur_contact || "",
      "Type promoteur":
        TYPE_PROMOTEUR_LABELS[s.promoteur_type] || s.promoteur_type,
      Statut: STATUT_STATION_LABELS[s.statut] || s.statut,
      "Numéro agrément": s.numero_agrement || "",
      "Date agrément": this.formaterDate(s.date_agrement),
      "Date expiration agrément": this.formaterDate(s.date_expiration_agrement),
      Observations: s.observations || "",
    }));
  }

  private formaterDate(iso?: string): string {
    if (!iso) return "";
    const d = new Date(iso);
    return isNaN(d.getTime())
      ? ""
      : `${String(d.getDate()).padStart(2, "0")}/` +
          `${String(d.getMonth() + 1).padStart(2, "0")}/${d.getFullYear()}`;
  }

  private nomFichier(extension: string): string {
    const d = new Date();
    const horodatage =
      `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}` +
      `${String(d.getDate()).padStart(2, "0")}`;
    return `stations_piscicoles_${horodatage}.${extension}`;
  }

  private telechargerBlob(blob: Blob, nomFichier: string): void {
    const url = URL.createObjectURL(blob);
    const lien = document.createElement("a");
    lien.href = url;
    lien.download = nomFichier;
    lien.click();
    URL.revokeObjectURL(url);
  }

  // -------------------------------------------------------------------------
  // Excel (.xlsx)
  // -------------------------------------------------------------------------

  exporterExcel(stations: StationPiscicole[]): void {
    const lignes = this.construireLignes(stations);
    const feuille = XLSX.utils.json_to_sheet(lignes);

    // Largeurs de colonnes basées sur le contenu
    const entetes = Object.keys(lignes[0] || {});
    feuille["!cols"] = entetes.map((e) => ({
      wch: Math.min(
        Math.max(e.length, ...lignes.map((l) => String(l[e] ?? "").length)) + 2,
        40,
      ),
    }));

    const classeur = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(classeur, feuille, "Stations piscicoles");
    XLSX.writeFile(classeur, this.nomFichier("xlsx"));
  }

  // -------------------------------------------------------------------------
  // CSV (texte) — BOM UTF-8 + séparateur ';' pour ouverture directe Excel FR
  // -------------------------------------------------------------------------

  exporterCSV(stations: StationPiscicole[]): void {
    const lignes = this.construireLignes(stations);
    if (lignes.length === 0) return;

    const entetes = Object.keys(lignes[0]);
    const echapper = (v: any): string => {
      const texte = String(v ?? "");
      return /[";\n\r]/.test(texte) ? `"${texte.replace(/"/g, '""')}"` : texte;
    };

    const contenu = [
      entetes.join(";"),
      ...lignes.map((l) => entetes.map((e) => echapper(l[e])).join(";")),
    ].join("\r\n");

    const blob = new Blob(["\ufeff" + contenu], {
      type: "text/csv;charset=utf-8",
    });
    this.telechargerBlob(blob, this.nomFichier("csv"));
  }

  // -------------------------------------------------------------------------
  // JSON — données brutes (enums techniques), réimportables
  // -------------------------------------------------------------------------

  exporterJSON(stations: StationPiscicole[]): void {
    const contenu = JSON.stringify(
      {
        module: "stations_piscicoles",
        exporte_le: new Date().toISOString(),
        total: stations.length,
        stations,
      },
      null,
      2,
    );
    const blob = new Blob([contenu], {
      type: "application/json;charset=utf-8",
    });
    this.telechargerBlob(blob, this.nomFichier("json"));
  }

  // -------------------------------------------------------------------------
  // PDF (pdfMake) — liste officielle en paysage avec en-tête Ministère
  // -------------------------------------------------------------------------

  exporterPDF(stations: StationPiscicole[]): void {
    const corps: any[] = [
      // En-têtes du tableau
      [
        { text: "Code", style: "th" },
        { text: "Nom", style: "th" },
        { text: "Province / Localité", style: "th" },
        { text: "Type", style: "th" },
        { text: "Espèces", style: "th" },
        { text: "Promoteur", style: "th" },
        { text: "Capacité (t/an)", style: "th" },
        { text: "Agrément", style: "th" },
        { text: "Statut", style: "th" },
      ],
      ...stations.map((s) => [
        { text: s.code_station, style: "td" },
        { text: s.nom, style: "td" },
        {
          text: s.province + (s.localite ? `\n${s.localite}` : ""),
          style: "td",
        },
        { text: TYPE_STATION_LABELS[s.type_station] || "", style: "td" },
        {
          text: s.especes_elevees
            ? s.especes_elevees.split(",").join(", ")
            : "—",
          style: "td",
        },
        { text: s.promoteur_nom, style: "td" },
        {
          text:
            s.capacite_production != null ? String(s.capacite_production) : "—",
          style: "td",
          alignment: "right",
        },
        { text: s.numero_agrement || "Non agréée", style: "td" },
        {
          text: STATUT_STATION_LABELS[s.statut] || "",
          style: "td",
          bold: true,
          color:
            s.statut === "ACTIVE"
              ? "#2e7d32"
              : s.statut === "FERMEE"
                ? "#c62828"
                : s.statut === "SUSPENDUE"
                  ? "#ef6c00"
                  : "#546e7a",
        },
      ]),
    ];

    const dateEdition = new Date().toLocaleDateString("fr-FR", {
      day: "2-digit",
      month: "long",
      year: "numeric",
    });

    const definition: any = {
      pageSize: "A4",
      pageOrientation: "landscape",
      pageMargins: [30, 90, 30, 40],

      header: {
        margin: [30, 20, 30, 0],
        columns: [
          {
            width: "*",
            stack: [
              { text: "RÉPUBLIQUE GABONAISE", bold: true, fontSize: 9 },
              { text: "Union — Travail — Justice", italics: true, fontSize: 7 },
            ],
          },
          {
            width: "*",
            stack: [
              {
                text: "MINISTÈRE DE LA MER, DE LA PÊCHE\nET DE L\u2019ÉCONOMIE BLEUE",
                bold: true,
                fontSize: 9,
                alignment: "center",
              },
              { text: "SIGDP-GABON", fontSize: 7, alignment: "center" },
            ],
          },
          {
            width: "*",
            stack: [
              {
                text: `Édité le ${dateEdition}`,
                fontSize: 8,
                alignment: "right",
              },
              {
                text: `${stations.length} station(s)`,
                fontSize: 8,
                alignment: "right",
              },
            ],
          },
        ],
      },

      footer: (pageActuelle: number, nombrePages: number) => ({
        text: `Registre des stations piscicoles — Page ${pageActuelle} / ${nombrePages}`,
        alignment: "center",
        fontSize: 7,
        color: "#777777",
        margin: [0, 10, 0, 0],
      }),

      content: [
        {
          text: "REGISTRE DES STATIONS PISCICOLES",
          fontSize: 13,
          bold: true,
          alignment: "center",
          decoration: "underline",
          margin: [0, 0, 0, 12],
        },
        {
          table: {
            headerRows: 1,
            widths: [55, "*", 75, 60, 70, 90, 45, 70, 55],
            body: corps,
          },
          layout: {
            fillColor: (rowIndex: number) =>
              rowIndex === 0
                ? "#1b5e20"
                : rowIndex % 2 === 0
                  ? "#f1f8e9"
                  : null,
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => "#bdbdbd",
            vLineColor: () => "#bdbdbd",
          },
        },
      ],

      styles: {
        th: {
          bold: true,
          fontSize: 7.5,
          color: "#ffffff",
          margin: [2, 3, 2, 3],
        },
        td: { fontSize: 7, margin: [2, 2, 2, 2] },
      },
    };

    pdfMake.createPdf(definition).download(this.nomFichier("pdf"));
  }
}
