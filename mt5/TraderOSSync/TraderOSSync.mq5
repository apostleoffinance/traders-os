//+------------------------------------------------------------------+
//| TraderOSSync.mq5 — read-only MT5 → Trader OS journal sync        |
//| OBSERVE · COLLECT · SEND — no trade execution functions.         |
//+------------------------------------------------------------------+
#property copyright "Trader OS"
#property version   "0.104"
#property strict

input string ApiBaseUrl          = "http://127.0.0.1:8000";
input string ConnectionToken     = "";
input int    SyncIntervalSeconds = 10;
input bool   DebugLogging        = true;

bool     g_sync_required = true;
datetime g_last_sync     = 0;
int      g_history_hours = 48;

//+------------------------------------------------------------------+
int OnInit()
  {
   if(StringLen(ConnectionToken) < 8)
     {
      Print("TraderOSSync: set ConnectionToken in EA inputs.");
      return INIT_PARAMETERS_INCORRECT;
     }
   EventSetTimer(MathMax(5, SyncIntervalSeconds));
   g_sync_required = true;
   if(DebugLogging)
      Print("TraderOSSync initialized. API=", ApiBaseUrl);
   return INIT_SUCCEEDED;
  }

//+------------------------------------------------------------------+
void OnDeinit(const int reason)
  {
   EventKillTimer();
  }

//+------------------------------------------------------------------+
void OnTradeTransaction(const MqlTradeTransaction &trans,
                        const MqlTradeRequest &request,
                        const MqlTradeResult &result)
  {
   g_sync_required = true;
   if(DebugLogging)
      Print("TraderOSSync: trade activity detected, sync queued.");
  }

//+------------------------------------------------------------------+
void OnTimer()
  {
   datetime now = TimeCurrent();
   if(!g_sync_required && (now - g_last_sync) < SyncIntervalSeconds)
      return;
   if(SendSync())
     {
      g_sync_required = false;
      g_last_sync = now;
     }
  }

//+------------------------------------------------------------------+
string JsonEscape(string s)
  {
   StringReplace(s, "\\", "\\\\");
   StringReplace(s, "\"", "\\\"");
   StringReplace(s, "\n", "\\n");
   StringReplace(s, "\r", "");
   return s;
  }

//+------------------------------------------------------------------+
string DirectionFromPositionType(long type)
  {
   if(type == POSITION_TYPE_BUY)
      return "LONG";
   return "SHORT";
  }

//+------------------------------------------------------------------+
string DealEntryType(long entry)
  {
   if(entry == DEAL_ENTRY_IN)
      return "IN";
   if(entry == DEAL_ENTRY_OUT)
      return "OUT";
   if(entry == DEAL_ENTRY_INOUT)
      return "INOUT";
   if(entry == DEAL_ENTRY_OUT_BY)
      return "OUT_BY";
   return "IN";
  }

//+------------------------------------------------------------------+
string DealDirection(long type)
  {
   if(type == DEAL_TYPE_BUY)
      return "LONG";
   return "SHORT";
  }

//+------------------------------------------------------------------+
bool PositionEntryInfo(ulong position_id, datetime &opened, double &entry_price, string &symbol, string &direction)
  {
   opened = 0;
   entry_price = 0;
   symbol = "";
   direction = "";
   if(!HistorySelectByPosition(position_id))
      return false;
   int total = HistoryDealsTotal();
   for(int i = 0; i < total; i++)
     {
      ulong ticket = HistoryDealGetTicket(i);
      if(ticket == 0)
         continue;
      long entry = HistoryDealGetInteger(ticket, DEAL_ENTRY);
      if(entry != DEAL_ENTRY_IN && entry != DEAL_ENTRY_INOUT)
         continue;
      opened = (datetime)HistoryDealGetInteger(ticket, DEAL_TIME);
      entry_price = HistoryDealGetDouble(ticket, DEAL_PRICE);
      symbol = HistoryDealGetString(ticket, DEAL_SYMBOL);
      long dtype = HistoryDealGetInteger(ticket, DEAL_TYPE);
      direction = DealDirection(dtype);
      return true;
     }
   return false;
  }

//+------------------------------------------------------------------+
bool ComputeMfeMae(const string symbol, const string direction, const double entry,
                   const datetime open_time, const datetime close_time,
                   double &mfe_price, double &mae_price, int &bars_used)
  {
   mfe_price = 0;
   mae_price = 0;
   bars_used = 0;
   if(open_time <= 0 || close_time <= open_time || entry <= 0)
      return false;
   if(!SymbolSelect(symbol, true))
      return false;
   MqlRates rates[];
   int copied = CopyRates(symbol, PERIOD_M1, open_time, close_time, rates);
   if(copied <= 0)
      return false;
   bars_used = copied;
   double max_high = rates[0].high;
   double min_low = rates[0].low;
   for(int i = 1; i < copied; i++)
     {
      if(rates[i].high > max_high)
         max_high = rates[i].high;
      if(rates[i].low < min_low)
         min_low = rates[i].low;
     }
   if(direction == "LONG")
     {
      mfe_price = max_high;
      mae_price = min_low;
     }
   else
     {
      mfe_price = min_low;
      mae_price = max_high;
     }
   return true;
  }

//+------------------------------------------------------------------+
bool PositionStillOpen(ulong position_id)
  {
   int total = PositionsTotal();
   for(int i = total - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket))
         continue;
      if((ulong)PositionGetInteger(POSITION_IDENTIFIER) == position_id)
         return true;
     }
   return false;
  }

//+------------------------------------------------------------------+
string IsoUtc(datetime t)
  {
   // DEAL_TIME/POSITION_TIME are broker server time, not UTC — correct by the
   // server's live GMT offset (DST-aware) before formatting, or dates shift near midnight.
   datetime utc = t - TimeGMTOffset();
   MqlDateTime dt;
   TimeToStruct(utc, dt);
   return StringFormat("%04d-%02d-%02dT%02d:%02d:%02dZ",
                       dt.year, dt.mon, dt.day, dt.hour, dt.min, dt.sec);
  }

//+------------------------------------------------------------------+
string BuildAccountJson()
  {
   string company = AccountInfoString(ACCOUNT_COMPANY);
   string server  = AccountInfoString(ACCOUNT_SERVER);
   string cur     = AccountInfoString(ACCOUNT_CURRENCY);
   long login     = AccountInfoInteger(ACCOUNT_LOGIN);
   double bal     = AccountInfoDouble(ACCOUNT_BALANCE);
   double eq      = AccountInfoDouble(ACCOUNT_EQUITY);
   return StringFormat(
      "\"account\":{\"login\":%I64d,\"server\":\"%s\",\"company\":\"%s\",\"currency\":\"%s\",\"balance\":%.2f,\"equity\":%.2f}",
      login,
      JsonEscape(server),
      JsonEscape(company),
      JsonEscape(cur),
      bal,
      eq
   );
  }

//+------------------------------------------------------------------+
string BuildPositionsJson()
  {
   string items = "";
   int total = PositionsTotal();
   for(int i = total - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket))
         continue;
      string sym = PositionGetString(POSITION_SYMBOL);
      long ptype = PositionGetInteger(POSITION_TYPE);
      double vol = PositionGetDouble(POSITION_VOLUME);
      double open_price = PositionGetDouble(POSITION_PRICE_OPEN);
      double cur_price = PositionGetDouble(POSITION_PRICE_CURRENT);
      double sl = PositionGetDouble(POSITION_SL);
      double tp = PositionGetDouble(POSITION_TP);
      double profit = PositionGetDouble(POSITION_PROFIT);
      double swap = PositionGetDouble(POSITION_SWAP);
      datetime opened = (datetime)PositionGetInteger(POSITION_TIME);
      string dir = DirectionFromPositionType(ptype);
      string item = StringFormat(
         "{\"external_position_id\":\"%I64u\",\"symbol_raw\":\"%s\",\"direction\":\"%s\",\"volume\":%.8f,"
         "\"entry_price\":%.8f,\"current_price\":%.8f,\"stop_loss\":%.8f,\"take_profit\":%.8f,"
         "\"opened_at\":\"%s\",\"unrealized_pnl\":%.2f,\"swap\":%.2f,\"commission\":0}",
         ticket,
         JsonEscape(sym),
         dir,
         vol,
         open_price,
         cur_price,
         sl,
         tp,
         IsoUtc(opened),
         profit,
         swap
      );
      if(StringLen(items) > 0)
         items += ",";
      items += item;
     }
   return "\"positions\":[" + items + "]";
  }

//+------------------------------------------------------------------+
string BuildDealsJson()
  {
   datetime from = TimeCurrent() - g_history_hours * 3600;
   HistorySelect(from, TimeCurrent());
   int deals = HistoryDealsTotal();
   string items = "";
   for(int i = deals - 1; i >= 0; i--)
     {
      ulong deal_ticket = HistoryDealGetTicket(i);
      if(deal_ticket == 0)
         continue;
      long entry = HistoryDealGetInteger(deal_ticket, DEAL_ENTRY);
      if(entry != DEAL_ENTRY_OUT && entry != DEAL_ENTRY_OUT_BY && entry != DEAL_ENTRY_INOUT)
         continue;
      ulong pos_id = (ulong)HistoryDealGetInteger(deal_ticket, DEAL_POSITION_ID);
      string sym = HistoryDealGetString(deal_ticket, DEAL_SYMBOL);
      long dtype = HistoryDealGetInteger(deal_ticket, DEAL_TYPE);
      double vol = HistoryDealGetDouble(deal_ticket, DEAL_VOLUME);
      double price = HistoryDealGetDouble(deal_ticket, DEAL_PRICE);
      double profit = HistoryDealGetDouble(deal_ticket, DEAL_PROFIT);
      double commission = HistoryDealGetDouble(deal_ticket, DEAL_COMMISSION);
      double swap = HistoryDealGetDouble(deal_ticket, DEAL_SWAP);
      datetime t = (datetime)HistoryDealGetInteger(deal_ticket, DEAL_TIME);
      string mfe_mae_json = "";
      datetime opened = 0;
      double entry_px = 0;
      string sym_mfe = sym;
      string dir_mfe = "";
      if(PositionEntryInfo(pos_id, opened, entry_px, sym_mfe, dir_mfe) && !PositionStillOpen(pos_id))
        {
         double mfe = 0, mae = 0;
         int bars = 0;
         if(ComputeMfeMae(sym_mfe, dir_mfe, entry_px, opened, t, mfe, mae, bars))
           {
            mfe_mae_json = StringFormat(",\"mfe_price\":%.8f,\"mae_price\":%.8f,\"mfe_mae_bars\":%d",
                                        mfe, mae, bars);
           }
        }
      string item = StringFormat(
         "{\"external_deal_id\":\"%I64u\",\"external_position_id\":\"%I64u\",\"symbol_raw\":\"%s\","
         "\"direction\":\"%s\",\"entry_type\":\"%s\",\"volume\":%.8f,\"price\":%.8f,"
         "\"profit\":%.2f,\"commission\":%.2f,\"swap\":%.2f,\"deal_time\":\"%s\"%s}",
         deal_ticket,
         pos_id,
         JsonEscape(sym),
         DealDirection(dtype),
         DealEntryType(entry),
         vol,
         price,
         profit,
         commission,
         swap,
         IsoUtc(t),
         mfe_mae_json
      );
      if(StringLen(items) > 0)
         items += ",";
      items += item;
     }
   return "\"recent_deals\":[" + items + "]";
  }

//+------------------------------------------------------------------+
void AddUniqueSymbol(string &symbols[], const string sym)
  {
   if(StringLen(sym) == 0 || ArraySize(symbols) >= 6)
      return;
   for(int i = 0; i < ArraySize(symbols); i++)
     {
      if(symbols[i] == sym)
         return;
     }
   int n = ArraySize(symbols);
   ArrayResize(symbols, n + 1);
   symbols[n] = sym;
  }

//+------------------------------------------------------------------+
string TimeframeCode(const ENUM_TIMEFRAMES tf)
  {
   if(tf == PERIOD_M1)  return "M1";
   if(tf == PERIOD_M5)  return "M5";
   if(tf == PERIOD_M15) return "M15";
   if(tf == PERIOD_M30) return "M30";
   if(tf == PERIOD_H1)  return "H1";
   if(tf == PERIOD_H4)  return "H4";
   if(tf == PERIOD_D1)  return "D1";
   return "";
  }

//+------------------------------------------------------------------+
string BuildBarsJson()
  {
   string symbols[];
   AddUniqueSymbol(symbols, _Symbol);
   int positions = PositionsTotal();
   for(int i = positions - 1; i >= 0; i--)
     {
      ulong ticket = PositionGetTicket(i);
      if(ticket == 0 || !PositionSelectByTicket(ticket))
         continue;
      AddUniqueSymbol(symbols, PositionGetString(POSITION_SYMBOL));
     }

   string items = "";
   int count = 0;
   const int max_items = 900;
   const int per_series = 160;
   for(int s = 0; s < ArraySize(symbols) && count < max_items; s++)
     {
      string sym = symbols[s];
      if(!SymbolSelect(sym, true))
         continue;
      ENUM_TIMEFRAMES frames[3];
      int frame_count = 0;
      if(s == 0)
        {
         frames[frame_count++] = PERIOD_M1;
        }
      frames[frame_count++] = PERIOD_M15;
      frames[frame_count++] = PERIOD_H1;
      for(int f = 0; f < frame_count && count < max_items; f++)
        {
         string code = TimeframeCode(frames[f]);
         if(StringLen(code) == 0)
            continue;
         MqlRates rates[];
         ArraySetAsSeries(rates, true);
         int copied = CopyRates(sym, frames[f], 0, per_series, rates);
         if(copied <= 0)
            continue;
         for(int b = copied - 1; b >= 0 && count < max_items; b--)
           {
            if(rates[b].time <= 0)
               continue;
            if(rates[b].open <= 0 || rates[b].high <= 0 || rates[b].low <= 0 || rates[b].close <= 0)
               continue;
            if(rates[b].high < rates[b].low || rates[b].high < rates[b].open || rates[b].high < rates[b].close)
               continue;
            if(rates[b].low > rates[b].open || rates[b].low > rates[b].close)
               continue;
            string item = StringFormat(
               "{\"symbol_raw\":\"%s\",\"timeframe\":\"%s\",\"timestamp\":\"%s\","
               "\"open\":%.8f,\"high\":%.8f,\"low\":%.8f,\"close\":%.8f,\"volume\":%.0f}",
               JsonEscape(sym),
               code,
               IsoUtc(rates[b].time),
               rates[b].open,
               rates[b].high,
               rates[b].low,
               rates[b].close,
               (double)rates[b].tick_volume
            );
            if(StringLen(items) > 0)
               items += ",";
            items += item;
            count++;
           }
        }
     }
   return "\"bars\":[" + items + "]";
  }

//+------------------------------------------------------------------+
bool SendSync()
  {
   string url = ApiBaseUrl;
   if(StringLen(url) == 0)
      return false;
   while(StringGetCharacter(url, StringLen(url) - 1) == '/')
      url = StringSubstr(url, 0, StringLen(url) - 1);
   url += "/api/integrations/mt5/sync";

   string body = "{";
   body += "\"event_type\":\"sync\",";
   body += "\"platform\":\"MT5\",";
   body += "\"sync_timestamp\":\"" + IsoUtc(TimeCurrent()) + "\",";
   body += "\"terminal_connected\":true,";
   body += BuildAccountJson() + ",";
   body += BuildPositionsJson() + ",";
   body += BuildDealsJson() + ",";
   body += BuildBarsJson();
   body += "}";

   char data[];
   char result[];
   string result_headers;
   StringToCharArray(body, data, 0, WHOLE_ARRAY, CP_UTF8);
   ArrayResize(data, ArraySize(data) - 1);

   string headers = "Content-Type: application/json\r\nAuthorization: Bearer " + ConnectionToken + "\r\n";
   ResetLastError();
   int code = WebRequest("POST", url, headers, 20000, data, result, result_headers);
   if(code == -1)
     {
      int err = GetLastError();
      Print("TraderOSSync WebRequest failed err=", err,
            ". Add URL to Tools → Options → Expert Advisors → Allow WebRequest for listed URL.");
      return false;
     }
   string response = CharArrayToString(result, 0, WHOLE_ARRAY, CP_UTF8);
   if(code < 200 || code >= 300)
     {
      Print("TraderOSSync HTTP ", code, " response=", response);
      if(code == 401 || code == 403)
         Print("TraderOSSync: check ConnectionToken or regenerate in Trader OS.");
      return false;
     }
   if(DebugLogging)
      Print("TraderOSSync OK: ", response);
   return true;
  }
//+------------------------------------------------------------------+
