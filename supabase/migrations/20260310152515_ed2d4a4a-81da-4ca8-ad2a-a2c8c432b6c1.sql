
CREATE OR REPLACE FUNCTION get_companies_here(p_user_id UUID, p_location_id UUID DEFAULT NULL)
RETURNS TABLE(
  company_id UUID,
  company_name TEXT,
  company_one_liner TEXT,
  company_stage TEXT,
  company_logo_url TEXT,
  industry_tags TEXT[],
  member_count BIGINT,
  members_here BIGINT,
  has_matching_needs BOOLEAN
)
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE
  v_location UUID;
  v_my_company UUID;
BEGIN
  IF p_user_id != auth.uid() THEN RAISE EXCEPTION 'Not authorized'; END IF;

  IF p_location_id IS NULL THEN
    SELECT ci.location_id INTO v_location
    FROM check_ins ci
    WHERE ci.user_id = p_user_id AND ci.checked_out_at IS NULL
    AND ci.checked_in_at > now() - interval '8 hours'
    ORDER BY ci.checked_in_at DESC LIMIT 1;
  ELSE
    v_location := p_location_id;
  END IF;

  IF v_location IS NULL THEN RETURN; END IF;

  SELECT cm.company_id INTO v_my_company
  FROM company_members cm WHERE cm.user_id = p_user_id LIMIT 1;

  RETURN QUERY
  SELECT
    c.id AS company_id,
    c.name AS company_name,
    c.one_liner AS company_one_liner,
    c.stage AS company_stage,
    c.logo_url AS company_logo_url,
    c.industry_tags,
    (SELECT COUNT(*) FROM company_members cm2 WHERE cm2.company_id = c.id)::BIGINT AS member_count,
    COUNT(DISTINCT ci.user_id)::BIGINT AS members_here,
    CASE WHEN v_my_company IS NOT NULL THEN
      EXISTS (
        SELECT 1 FROM company_needs cn
        JOIN company_offers co ON co.offer_type = cn.need_type
        WHERE ((cn.company_id = v_my_company AND co.company_id = c.id)
           OR (cn.company_id = c.id AND co.company_id = v_my_company))
        AND cn.is_active AND co.is_active
      )
    ELSE false END AS has_matching_needs
  FROM check_ins ci
  JOIN company_members cm ON cm.user_id = ci.user_id
  JOIN companies c ON c.id = cm.company_id
  LEFT JOIN user_settings us ON us.user_id = ci.user_id
  WHERE ci.location_id = v_location
    AND ci.checked_out_at IS NULL
    AND ci.checked_in_at > now() - interval '8 hours'
    AND COALESCE(us.visibility, 'everyone') != 'hidden'
    AND c.id != COALESCE(v_my_company, '00000000-0000-0000-0000-000000000000'::uuid)
  GROUP BY c.id, c.name, c.one_liner, c.stage, c.logo_url, c.industry_tags
  ORDER BY has_matching_needs DESC, members_here DESC;
END;
$$;
