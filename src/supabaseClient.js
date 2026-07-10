import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = "https://khiabbzmcyyldbigylol.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_rYPYVnmAmmebnb30OhepHw_y7Z7XYo2";

export const supabase = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);

