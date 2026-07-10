// src/app/services/mareyeur-pdf.service.ts
// Module Mareyeurs - SIGDP-GABON
// Impression pdfMake : certificat d'agrément (A4) + carte professionnelle
// (format carte bancaire 85,6 x 54 mm, recto/verso)
//
// Mise en page validée par rendu réel (les deux documents tiennent
// respectivement sur 1 page A4 et 2 pages carte).

import { Injectable } from "@angular/core";

import pdfMake from "pdfmake/build/pdfmake";
import pdfFonts from "pdfmake/build/vfs_fonts";

// Selon la version de pdfmake 0.2.x, l'une des deux formes suivantes s'applique :
(pdfMake as any).vfs = (pdfFonts as any).pdfMake?.vfs || (pdfFonts as any).vfs;

import { Mareyeur, AgrementMareyage } from "../models/mareyeur.model";

// Armoiries / logo du ministère en base64 (data URI). Laisser vide si absent :
// l'espace réservé du certificat reste simplement vide.
const LOGO_BASE64 = "";

// Builders des définitions de documents — miroir JS du service Angular
// (les mêmes objets docDefinition seront utilisés dans mareyeur-pdf.service.ts)

const VERT = "#009e60"; // Drapeau gabonais
const JAUNE = "#fcd116";
const BLEU = "#3a75c4";
const GRIS = "#555555";

function formaterDate(iso?: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  });
}

function nomAffiche(mareyeur: Mareyeur): string {
  return mareyeur.type_personne === "morale"
    ? mareyeur.raison_sociale || ""
    : `${mareyeur.nom || ""} ${mareyeur.prenom || ""}`.trim();
}

function libelleCategorie(categorie: string): string {
  const libelles: Record<string, string> = {
    mareyeur_simple: "Mareyeur simple",
    mareyeur_exportateur: "Mareyeur-exportateur",
  };
  return libelles[categorie] || categorie;
}

function barreTricolore(largeur: number) {
  const tiers = largeur / 3;
  return {
    canvas: [
      { type: "rect", x: 0, y: 0, w: tiers, h: 4, color: VERT },
      { type: "rect", x: tiers, y: 0, w: tiers, h: 4, color: JAUNE },
      { type: "rect", x: tiers * 2, y: 0, w: tiers, h: 4, color: BLEU },
    ],
    margin: [0, 8, 0, 12],
  };
}

function contenuQr(agrement: AgrementMareyage, mareyeur: Mareyeur): string {
  // À adapter si une page publique de vérification existe :
  // return `https://server1.sigdp.org/verification/agrement/${agrement.code}`;
  return [
    "SIGDP",
    "AGREMENT",
    agrement.code,
    mareyeur.code,
    agrement.date_expiration || "",
  ].join("|");
}

function formatXAF(amount: number): string {
  return (
    Math.round(amount)
      .toLocaleString("fr-FR", {
        minimumFractionDigits: 0,
        maximumFractionDigits: 0,
      })
      .replace(/\u202f/g, " ") + " FCFA"
  );
}

// ---------------------------------------------------------------------------
// 1. Certificat d'agrément (A4 portrait)
// ---------------------------------------------------------------------------

function construireDocumentAgrement(
  mareyeur: Mareyeur,
  agrement: AgrementMareyage,
  logoBase64: string | null,
) {
  const entete = {
    columns: [
      logoBase64 ? { image: logoBase64, width: 60 } : { width: 60, text: "" },
      {
        width: "*",
        alignment: "center",
        stack: [
          { text: "RÉPUBLIQUE GABONAISE", bold: true, fontSize: 12 },
          {
            text: "Union – Travail – Justice",
            italics: true,
            fontSize: 8,
            margin: [0, 1, 0, 6],
          },
          {
            text: "MINISTÈRE DE LA MER, DE LA PÊCHE",
            bold: true,
            fontSize: 10,
          },
          { text: "ET DE L\u2019ÉCONOMIE BLEUE", bold: true, fontSize: 10 },
          {
            text: "Direction Générale des Pêches et de l\u2019Aquaculture",
            fontSize: 9,
            margin: [0, 3, 0, 0],
          },
        ],
      },
      { width: 60, text: "" },
    ],
  };

  const identite =
    mareyeur.type_personne === "morale"
      ? [
          ["Raison sociale", nomAffiche(mareyeur)],
          ["RCCM", mareyeur.rccm || "—"],
          ["NIF", mareyeur.nif || "—"],
        ]
      : [
          ["Nom et prénom", nomAffiche(mareyeur)],
          [
            "Né(e) le",
            `${formaterDate(mareyeur.date_naissance)} à ${mareyeur.lieu_naissance || "—"}`,
          ],
          ["Nationalité", mareyeur.nationalite || "—"],
          ["NIF", mareyeur.nif || "—"],
        ];

  const lignes = [
    ["Code mareyeur", mareyeur.code],
    ...identite,
    ["Adresse", mareyeur.adresse || "—"],
    ["Téléphone", mareyeur.telephone || "—"],
    ["Catégorie", libelleCategorie(agrement.categorie)],
    ["Zones d\u2019activité", mareyeur.zones_activite || "—"],
    ["Sites de débarquement", mareyeur.sites_debarquement || "—"],
  ];

  return {
    pageSize: "A4",
    pageMargins: [50, 40, 50, 50],
    content: [
      entete,
      barreTricolore(495),
      {
        text: "AGRÉMENT DE MAREYAGE",
        alignment: "center",
        bold: true,
        fontSize: 18,
        color: VERT,
        margin: [0, 10, 0, 2],
      },
      {
        text: `N° ${agrement.code}`,
        alignment: "center",
        bold: true,
        fontSize: 13,
        margin: [0, 0, 0, 18],
      },
      {
        text:
          "Le Directeur Général des Pêches et de l\u2019Aquaculture, vu la " +
          "réglementation en vigueur relative à l\u2019exercice de la profession " +
          "de mareyeur en République Gabonaise, et après instruction du dossier " +
          "de demande, accorde le présent agrément à :",
        fontSize: 10,
        alignment: "justify",
        margin: [0, 0, 0, 12],
        lineHeight: 1.3,
      },
      {
        table: {
          widths: [150, "*"],
          body: lignes.map((ligne: any[]) => {
            const [libelle, valeur] = ligne;
            return [
              {
                text: libelle,
                bold: true,
                fontSize: 9,
                color: GRIS,
                fillColor: "#f2f2f2",
                margin: [6, 4, 4, 4],
              },
              { text: String(valeur), fontSize: 10, margin: [6, 4, 4, 4] },
            ];
          }),
        },
        layout: {
          hLineColor: () => "#cccccc",
          vLineColor: () => "#cccccc",
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
        },
        margin: [0, 0, 0, 16],
      },
      {
        columns: [
          {
            width: "*",
            table: {
              widths: ["*", "*", "*"],
              body: [
                [
                  {
                    text: [
                      { text: "Délivré le\n", fontSize: 8, color: GRIS },
                      {
                        text: formaterDate(agrement.date_delivrance),
                        bold: true,
                        fontSize: 10,
                      },
                    ],
                    alignment: "center",
                    margin: [0, 6, 0, 6],
                  },
                  {
                    text: [
                      {
                        text: "Valable jusqu\u2019au\n",
                        fontSize: 8,
                        color: GRIS,
                      },
                      {
                        text: formaterDate(agrement.date_expiration),
                        bold: true,
                        fontSize: 10,
                      },
                    ],
                    alignment: "center",
                    margin: [0, 6, 0, 6],
                  },
                  {
                    text: [
                      {
                        text: "Redevance acquittée\n",
                        fontSize: 8,
                        color: GRIS,
                      },
                      {
                        text: agrement.montant_redevance
                          ? `${formatXAF(agrement.montant_redevance)}`
                          : "—",
                        bold: true,
                        fontSize: 10,
                      },
                    ],
                    alignment: "center",
                    margin: [0, 6, 0, 6],
                  },
                ],
              ],
            },
            layout: {
              hLineColor: () => VERT,
              vLineColor: () => VERT,
              hLineWidth: () => 0.8,
              vLineWidth: () => 0.8,
            },
          },
        ],
        margin: [0, 0, 0, 18],
      },
      {
        text:
          "Le présent agrément est délivré sous réserve du strict respect de la " +
          "réglementation en vigueur, notamment des règles d\u2019hygiène et de " +
          "salubrité applicables à la manipulation des produits halieutiques. " +
          "Il est personnel, incessible, et peut être suspendu ou retiré en cas " +
          "de manquement constaté par les services de contrôle.",
        fontSize: 8.5,
        italics: true,
        alignment: "justify",
        color: GRIS,
        lineHeight: 1.3,
        margin: [0, 0, 0, 28],
      },
      {
        columns: [
          {
            width: "auto",
            stack: [
              { qr: contenuQr(agrement, mareyeur), fit: 85, eccLevel: "M" },
              {
                text: "Vérification SIGDP",
                fontSize: 7,
                color: GRIS,
                margin: [0, 4, 0, 0],
                alignment: "center",
              },
            ],
          },
          { width: "*", text: "" },
          {
            width: 220,
            alignment: "center",
            stack: [
              {
                text: `Fait à Libreville, le ${formaterDate(agrement.date_delivrance)}`,
                fontSize: 10,
                margin: [0, 0, 0, 8],
              },
              {
                text: "Le Directeur Général des Pêches\net de l\u2019Aquaculture",
                bold: true,
                fontSize: 10,
                margin: [0, 0, 0, 55],
              },
              {
                canvas: [
                  {
                    type: "line",
                    x1: 20,
                    y1: 0,
                    x2: 200,
                    y2: 0,
                    lineWidth: 0.5,
                    lineColor: GRIS,
                  },
                ],
              },
              {
                text: "(signature et cachet)",
                fontSize: 7,
                color: GRIS,
                margin: [0, 3, 0, 0],
              },
            ],
          },
        ],
      },
    ],
    footer: (page: number, total: number) => ({
      columns: [
        {
          text: "Document généré par SIGDP-GABON — Système Intégré de Gestion des Données des Pêches",
          fontSize: 7,
          color: GRIS,
          margin: [50, 0, 0, 0],
        },
        {
          text: `Page ${page}/${total}`,
          alignment: "right",
          fontSize: 7,
          color: GRIS,
          margin: [0, 0, 50, 0],
        },
      ],
    }),
  };
}

// ---------------------------------------------------------------------------
// 2. Carte professionnelle de mareyeur (format carte bancaire, recto/verso)
// ---------------------------------------------------------------------------

const CARTE_L = 242.6; // 85,6 mm
// const CARTE_L = 300.6; // 85,6 mm
const CARTE_H = 153; // 54 mm

function construireDocumentCarte(
  mareyeur: Mareyeur,
  agrement: AgrementMareyage,
  photoBase64: string | null,
) {
  const nom = nomAffiche(mareyeur);
  const initiales = nom
    .split(/\s+/)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const blocPhoto = photoBase64
    ? { width: 56, image: photoBase64, fit: [52, 58] }
    : {
        width: 56,
        table: {
          widths: [46],
          heights: [52],
          body: [
            [
              {
                text: initiales || "MW",
                alignment: "center",
                fontSize: 16,
                bold: true,
                color: "#9e9e9e",
                margin: [0, 18, 0, 0],
              },
            ],
          ],
        },
        layout: {
          hLineColor: () => "#bdbdbd",
          vLineColor: () => "#bdbdbd",
          hLineWidth: () => 0.5,
          vLineWidth: () => 0.5,
          fillColor: () => "#eeeeee",
        },
      };

  const ligneInfo = (
    libelle: string,
    valeur: string,
    options: { bold?: boolean; couleur?: string; fontSize?: number } = {},
  ) => ({
    columns: [
      { width: 52, text: libelle, fontSize: 6, color: GRIS },
      {
        text: valeur,
        fontSize: options.fontSize || 7,
        bold: !!options.bold,
        color: options.couleur || "#222222",
      },
    ],
    margin: [0, 0, 0, 2.5],
  });

  return {
    pageSize: { width: CARTE_L, height: CARTE_H },
    pageMargins: [12, 9, 12, 14],
    // Bandeaux dessinés hors flux : bande verte en haut, tricolore en bas
    background: () => ({
      canvas: [
        { type: "rect", x: 0, y: 0, w: CARTE_L, h: 32, color: VERT },
        {
          type: "rect",
          x: 0,
          y: CARTE_H - 6,
          w: CARTE_L / 3,
          h: 6,
          color: VERT,
        },
        {
          type: "rect",
          x: CARTE_L / 3,
          y: CARTE_H - 6,
          w: CARTE_L / 3,
          h: 6,
          color: JAUNE,
        },
        {
          type: "rect",
          x: (CARTE_L / 3) * 2,
          y: CARTE_H - 6,
          w: CARTE_L / 3,
          h: 6,
          color: BLEU,
        },
      ],
    }),
    content: [
      // ------------------------------ RECTO ------------------------------
      {
        text: "RÉPUBLIQUE GABONAISE — MINISTÈRE DE LA MER, DE LA PÊCHE ET DE L\u2019ÉCONOMIE BLEUE",
        fontSize: 5.2,
        color: "#d8efe3",
        alignment: "center",
      },
      {
        text: "CARTE PROFESSIONNELLE DE MAREYEUR",
        fontSize: 9,
        bold: true,
        color: "white",
        alignment: "center",
        margin: [0, 2.5, 0, 14],
      },
      {
        columns: [
          blocPhoto,
          {
            width: "*",
            margin: [8, 0, 0, 0],
            stack: [
              {
                text: nom,
                bold: true,
                fontSize: 10,
                color: "#1a1a1a",
                margin: [0, 0, 0, 1],
              },
              {
                text:
                  mareyeur.type_personne === "morale"
                    ? "Personne morale"
                    : "Personne physique",
                fontSize: 6,
                color: GRIS,
                margin: [0, 0, 0, 5],
              },
              ligneInfo("Code", mareyeur.code ? mareyeur.code : "N/A", {
                bold: true,
                fontSize: 6,
              }),
              ligneInfo("Agrément", agrement.code ? agrement.code : "N/A", {
                bold: true,
                fontSize: 6,
              }),
              ligneInfo("Catégorie", libelleCategorie(agrement.categorie)),
              ligneInfo(
                "Valable jusqu\u2019au",
                formaterDate(agrement.date_expiration),
                { bold: true, couleur: VERT },
              ),
            ],
          },
          //   {
          //     width: 50,
          //     stack: [
          //       { qr: contenuQr(agrement, mareyeur), fit: 48, eccLevel: "L" },
          //     ],
          //     margin: [2, 4, 0, 0],
          //   },
        ],
      },
      // ------------------------------ VERSO ------------------------------
      {
        text: "SIGDP-GABON — CARTE PROFESSIONNELLE DE MAREYEUR",
        fontSize: 6.5,
        bold: true,
        color: "white",
        alignment: "center",
        pageBreak: "before",
        margin: [0, 7, 0, 22],
      },
      {
        text:
          "La présente carte est strictement personnelle et incessible. " +
          "Elle doit être présentée à toute réquisition des agents de contrôle " +
          "des pêches. Toute falsification expose son détenteur aux sanctions " +
          "prévues par la réglementation en vigueur.",
        fontSize: 5.8,
        color: "#333333",
        alignment: "justify",
        lineHeight: 1.25,
        margin: [0, 0, 0, 6],
      },
      {
        columns: [
          {
            width: "*",
            stack: [
              {
                text: "Zones d\u2019activité",
                fontSize: 5.8,
                bold: true,
                color: GRIS,
              },
              {
                text: mareyeur.zones_activite || "—",
                fontSize: 6.3,
                margin: [0, 1, 0, 4],
              },
              {
                text: "Sites de débarquement",
                fontSize: 5.8,
                bold: true,
                color: GRIS,
              },
              {
                text: mareyeur.sites_debarquement || "—",
                fontSize: 6.3,
                margin: [0, 1, 0, 0],
              },
            ],
          },
          {
            width: 52,
            stack: [
              { qr: contenuQr(agrement, mareyeur), fit: 44, eccLevel: "L" },
              {
                text: "sigdp.org",
                fontSize: 5.2,
                color: GRIS,
                alignment: "center",
                margin: [0, 2, 0, 0],
              },
            ],
          },
        ],
      },
      {
        text: "En cas de perte, prière de la restituer à la Direction Générale des Pêches et de l\u2019Aquaculture — Libreville",
        fontSize: 4.8,
        color: GRIS,
        alignment: "center",
        margin: [0, 5, 0, 0],
      },
    ],
  };
}

@Injectable({ providedIn: "root" })
export class MareyeurPdfService {
  /** Ouvre le certificat d'agrément dans un nouvel onglet. */
  imprimerAgrement(mareyeur: Mareyeur, agrement: AgrementMareyage): void {
    pdfMake
      .createPdf(
        construireDocumentAgrement(
          mareyeur,
          agrement,
          LOGO_BASE64 || null,
        ) as any,
      )
      .open();
  }

  /** Télécharge le certificat d'agrément. */
  telechargerAgrement(mareyeur: Mareyeur, agrement: AgrementMareyage): void {
    pdfMake
      .createPdf(
        construireDocumentAgrement(
          mareyeur,
          agrement,
          LOGO_BASE64 || null,
        ) as any,
      )
      .download(`agrement_${agrement.code}.pdf`);
  }

  /** Ouvre la carte professionnelle (recto/verso). La photo est chargée
   *  depuis mareyeur.photo si disponible, sinon un cadre avec les initiales
   *  est affiché. */
  async imprimerCarte(
    mareyeur: Mareyeur,
    agrement: AgrementMareyage,
  ): Promise<void> {
    const photo = await chargerImageBase64(mareyeur.photo);
    pdfMake
      .createPdf(construireDocumentCarte(mareyeur, agrement, photo) as any)
      .open();
  }

  async telechargerCarte(
    mareyeur: Mareyeur,
    agrement: AgrementMareyage,
  ): Promise<void> {
    const photo = await chargerImageBase64(mareyeur.photo);
    pdfMake
      .createPdf(construireDocumentCarte(mareyeur, agrement, photo) as any)
      .download(`carte_mareyeur_${mareyeur.code}.pdf`);
  }
}

/** Charge une image (URL ou chemin) et la convertit en data URI base64.
 *  Retourne null en cas d'échec (photo absente, CORS, 404...) : les
 *  builders basculent alors sur l'espace réservé avec initiales. */
async function chargerImageBase64(url?: string | null): Promise<string | null> {
  if (!url) {
    return null;
  }
  try {
    const reponse = await fetch(url);
    if (!reponse.ok) {
      return null;
    }
    const blob = await reponse.blob();
    return await new Promise<string | null>((resolve) => {
      const lecteur = new FileReader();
      lecteur.onload = () => resolve(lecteur.result as string);
      lecteur.onerror = () => resolve(null);
      lecteur.readAsDataURL(blob);
    });
  } catch {
    return null;
  }
}
