/**
 * lib/data/contract.js — Repository sözleşmesi (JSDoc).
 * Ekranlar YALNIZCA bu metodları kullanır. İki uygulama: demoRepo (localStorage) ve supabaseRepo.
 * Tüm tarihler 'YYYY-MM-DD' (yerel) veya ISO timestamptz string; tutarlar ondalıklı sayı (DB numeric).
 *
 * @typedef {Object} Repo
 * @property {'demo'|'supabase'} mode
 * @property {() => Promise<{household:Object, members:Object[], me:Object|null}>} init
 * @property {{exportAll:()=>Promise<Object>}} backup
 * @property {(onChange:(table:string)=>void)=>(()=>void)} subscribe
 * @property {{get:()=>Promise<Object>, update:(patch:Object)=>Promise<Object>, rotateJoinCode:(o?:{role?:string,hours?:number,uses?:number})=>Promise<string>}} household
 * @property {{list:()=>Promise<Object[]>, create:(m:Object)=>Promise<Object>, update:(id:string,patch:Object)=>Promise<Object>}} members
 * @property {{list:(q:{from:string,to:string})=>Promise<Object[]>, create:(e:Object)=>Promise<Object>, update:(id:string,patch:Object)=>Promise<Object>, remove:(id:string)=>Promise<void>, skipOccurrence:(id:string,date:string)=>Promise<Object>}} events
 * @property {{list:()=>Promise<Object[]>, balances:()=>Promise<Object[]>, create:(a:Object)=>Promise<Object>}} accounts
 * @property {{list:()=>Promise<Object[]>}} categories
 * @property {{list:(q:{period?:string,limit?:number,planId?:string})=>Promise<Object[]>, create:(t:Object)=>Promise<Object>, update:(id:string,patch:Object)=>Promise<Object>, remove:(id:string)=>Promise<void>}} transactions
 * @property {{list:(period:string)=>Promise<Object[]>, set:(b:Object)=>Promise<Object>, remove:(period:string,categoryId:string|null)=>Promise<void>}} budgets
 * @property {{list:()=>Promise<Object[]>, create:(r:Object)=>Promise<Object>, update:(id:string,patch:Object)=>Promise<Object>}} recurring
 * @property {{list:()=>Promise<Object[]>, get:(id:string)=>Promise<Object>, items:(planId:string)=>Promise<Object[]>, create:(p:Object)=>Promise<Object>, update:(id:string,patch:Object)=>Promise<Object>, addItem:(i:Object)=>Promise<Object>, updateItem:(id:string,patch:Object)=>Promise<Object>}} plans
 * @property {{list:()=>Promise<Object[]>, create:(o:Object)=>Promise<Object>}} occasions
 * @property {{list:()=>Promise<Object[]>, create:(d:Object)=>Promise<Object>}} documents
 * @property {{list:()=>Promise<Object[]>, create:(t:Object)=>Promise<Object>, update:(id:string,patch:Object)=>Promise<Object>, complete:(id:string,nextDue?:string|null)=>Promise<Object>, uncomplete:(id:string)=>Promise<Object>, postpone:(id:string,days?:number)=>Promise<Object>, skip:(id:string,nextDue:string)=>Promise<Object>, completions:(from?:string)=>Promise<Object[]>}} tasks
 * @property {{lists:()=>Promise<Object[]>, items:(listId?:string)=>Promise<Object[]>, addItem:(i:Object)=>Promise<Object>, toggleItem:(id:string)=>Promise<Object>, clearChecked:(listId:string)=>Promise<void>}} shopping
 * @property {{list:()=>Promise<Object[]>, markRead:(id:string)=>Promise<void>}} notifications
 * @property {{today:(from:string,days:number,period:string)=>Promise<{agenda:Object,month:Object,budget:Object[],shopping:Object[],notifs:Object[]}>, month:(period:string)=>Promise<Object>, budgetStatus:(period:string)=>Promise<Object[]>, agenda:(from:string,days:number)=>Promise<Object>}} summary
 * @property {{rates:()=>Promise<Object>}} fx
 * @property {{signIn:(email:string,password:string)=>Promise<void>, signUp:(email:string,password:string)=>Promise<void>, changePassword:(password:string)=>Promise<void>, signOut:()=>Promise<void>, createHousehold:(p:Object)=>Promise<string>, joinHousehold:(code:string)=>Promise<string>}} auth
 */
export {};
