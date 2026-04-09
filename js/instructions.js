import dbInfoOk, { displayDbNotOkText } from "./dbInfoOk.js";

addMdToPage(`
  ## Övning Sverige - kommuner, medelinkomst, medelålder och valresultat 2018 & 2022

  ### Instruktioner
  * Det finns mycket du kan undersöka här!
  * T.ex. röstar folk olika i olika delar av landet? Den exakta geografiska datan gör att du kan arbeta med olika indelningar (väst, öst, norr, söder, mitten).
  * Du kan även dela in data efter län för lite större områden än kommuner. Då måste du aggregera data (t.ex.) valresultat för alla kommuner som ingår i ett visst län!
  * Finns det skillnader i hur folk röstar i kommuner med hög respektive låg medelinkomst.
  * Finns det några större skillnader i medelålder mellan olika kommuner. Kan detta knytas till större områden? Bor det yngre människor i söder än i norr?
  * Verkar folktäthet (männniskor/kvadratkilometer) ha betydelse för hur man röstar?
  * Verkar medelålder i ett visst område ha betydelse för man röstar?
  * Går det att hitta faktorer som verkar påverka hur högt valdeltagande det finns på olika platser?

  **Både möjligheterna och dataseten är stora!**
  * Välj någon punkt du tycker verkar intressant att börja med.
  * Sannolikt kommer vi att basera grupp/projekt-arbetet ni snart börjar med på dessa dataset också!

  ### Tänk på!
  * Eftersom du inte har tillgång till att kunnna skriva till databas och flera olika datakällor behöver du sköta (motsvarigheten) till joins, group by:s etc med hjälp av JavaScript!
  * Se dessa artiklar:
    * [Hur kan jag göra motsvarigheten till en join i JavaScript?](https://dm24s-tuc.lms.nodehill.se/article/hur-kan-jag-gora-motsvarigheten-till-en-sql-join-i-javascript) - ett förenklat tillvägagångssätt jämfört med äldre exempel!
    * [Motsvarigheter till join och group by i JavaScript](https://dm24s-tuc.lms.nodehill.se/article/motsvarigheter-till-join-och-group-by-i-javascript-kodexempel)
   * Tänk även på att det förmodligen är klokt att skapa "hjälpande" filer som du kan importera i andra filer för att underlätta ditt arbete!
     * Se [Kodexempel: Att dela variabler mellan olika filer i JavaScript](https://dm24s-tuc.lms.nodehill.se/article/kodexempel-att-dela-variabler-mellan-olika-filer-i-javascript-och-i-var-mall)
`);