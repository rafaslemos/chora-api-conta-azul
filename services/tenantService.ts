import { supabase, isSupabaseConfigured } from '../lib/supabase';
import { Tenant } from '../types';

export const tenantService = {
  /**
   * Lista todos os clientes do Supabase.
   */
  async list(): Promise<Tenant[]> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado. Configure as variáveis de ambiente.');
    }

    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) {
        console.error('Erro ao buscar tenants do Supabase:', error);
        if (error.status === 403) {
          throw new Error('Acesso negado. Verifique se o schema app_core está exposto no Supabase Dashboard (Settings > API > Exposed Schemas). Sem expor o schema, todas as queries retornam 403.');
        }
        throw error;
      }

      // Se não houver dados, retorna array vazio
      if (!data || data.length === 0) {
        return [];
      }

      // Mapeamento dos dados do banco (snake_case) para nossa interface (camelCase)
      return data.map((item: any) => ({
        id: item.id,
        name: item.name,
        cnpj: item.cnpj,
        email: item.email,
        razaoSocial: item.razao_social,
        nomeFantasia: item.nome_fantasia,
        phone: item.phone,
        address: item.address_logradouro ? {
          logradouro: item.address_logradouro,
          numero: item.address_numero,
          bairro: item.address_bairro,
          cidade: item.address_cidade,
          estado: item.address_estado,
          cep: item.address_cep,
        } : undefined,
        status: item.status,
        plan: item.plan,
        joinedAt: item.created_at,
        connections: {
          contaAzul: item.connections_conta_azul || false
        }
      }));
    } catch (error) {
      console.error('Erro ao buscar tenants do Supabase:', error);
      throw error;
    }
  },

  /**
   * Cria um novo cliente
   */
  async create(tenant: Partial<Tenant>): Promise<Tenant> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado. Configure as variáveis de ambiente.');
    }

    try {
      // Obter o ID do usuário logado (partner_id)
      const { data: { user }, error: userError } = await supabase.auth.getUser();
      
      if (userError || !user) {
        throw new Error('Usuário não autenticado. Faça login para criar um cliente.');
      }

      const insertData: any = {
        name: tenant.name,
        cnpj: tenant.cnpj,
        email: tenant.email,
        partner_id: user.id, // ID do parceiro logado
        status: 'ACTIVE',
        plan: 'BASIC',
        connections_conta_azul: false
      };

      // Adicionar campos opcionais se existirem
      if (tenant.razaoSocial) {
        insertData.razao_social = tenant.razaoSocial;
      }
      if (tenant.nomeFantasia) {
        insertData.nome_fantasia = tenant.nomeFantasia;
      }
      if (tenant.phone) {
        insertData.phone = tenant.phone;
      }
      if (tenant.address) {
        if (tenant.address.logradouro) insertData.address_logradouro = tenant.address.logradouro;
        if (tenant.address.numero) insertData.address_numero = tenant.address.numero;
        if (tenant.address.bairro) insertData.address_bairro = tenant.address.bairro;
        if (tenant.address.cidade) insertData.address_cidade = tenant.address.cidade;
        if (tenant.address.estado) insertData.address_estado = tenant.address.estado;
        if (tenant.address.cep) insertData.address_cep = tenant.address.cep;
      }

      const { data, error } = await supabase
        .from('tenants')
        .insert([insertData])
        .select()
        .single();

      if (error) {
        console.error('Erro ao criar tenant no Supabase:', error);
        if (error.status === 403) {
          throw new Error('Acesso negado. Verifique se o schema app_core está exposto no Supabase Dashboard (Settings > API > Exposed Schemas).');
        }
        throw error;
      }

      return {
        id: data.id,
        name: data.name,
        cnpj: data.cnpj,
        email: data.email,
        razaoSocial: data.razao_social,
        nomeFantasia: data.nome_fantasia,
        phone: data.phone,
        address: data.address_logradouro ? {
          logradouro: data.address_logradouro,
          numero: data.address_numero,
          bairro: data.address_bairro,
          cidade: data.address_cidade,
          estado: data.address_estado,
          cep: data.address_cep,
        } : undefined,
        status: data.status,
        plan: data.plan,
        joinedAt: data.created_at,
        connections: {
          contaAzul: data.connections_conta_azul
        }
      };
    } catch (error) {
      console.error('Erro ao criar tenant no Supabase:', error);
      throw error;
    }
  },

  /**
   * Atualiza um cliente existente
   */
  async update(id: string, tenant: Partial<Tenant>): Promise<Tenant> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado. Configure as variáveis de ambiente.');
    }

    try {
      const updateData: any = {
        name: tenant.name,
        cnpj: tenant.cnpj,
        email: tenant.email,
      };

      // Adicionar campos opcionais se existirem
      if (tenant.razaoSocial !== undefined) {
        updateData.razao_social = tenant.razaoSocial || null;
      }
      if (tenant.nomeFantasia !== undefined) {
        updateData.nome_fantasia = tenant.nomeFantasia || null;
      }
      if (tenant.phone !== undefined) {
        updateData.phone = tenant.phone || null;
      }
      if (tenant.address) {
        updateData.address_logradouro = tenant.address.logradouro || null;
        updateData.address_numero = tenant.address.numero || null;
        updateData.address_bairro = tenant.address.bairro || null;
        updateData.address_cidade = tenant.address.cidade || null;
        updateData.address_estado = tenant.address.estado || null;
        updateData.address_cep = tenant.address.cep || null;
      } else if (tenant.address === null) {
        // Se address for explicitamente null, limpar todos os campos de endereço
        updateData.address_logradouro = null;
        updateData.address_numero = null;
        updateData.address_bairro = null;
        updateData.address_cidade = null;
        updateData.address_estado = null;
        updateData.address_cep = null;
      }

      const { data, error } = await supabase
        .from('tenants')
        .update(updateData)
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Erro ao atualizar tenant no Supabase:', error);
        if (error.status === 403) {
          throw new Error('Acesso negado. Verifique se o schema app_core está exposto no Supabase Dashboard (Settings > API > Exposed Schemas).');
        }
        throw error;
      }

      return {
        id: data.id,
        name: data.name,
        cnpj: data.cnpj,
        email: data.email,
        razaoSocial: data.razao_social,
        nomeFantasia: data.nome_fantasia,
        phone: data.phone,
        address: data.address_logradouro ? {
          logradouro: data.address_logradouro,
          numero: data.address_numero,
          bairro: data.address_bairro,
          cidade: data.address_cidade,
          estado: data.address_estado,
          cep: data.address_cep,
        } : undefined,
        status: data.status,
        plan: data.plan,
        joinedAt: data.created_at,
        connections: {
          contaAzul: data.connections_conta_azul
        }
      };
    } catch (error) {
      console.error('Erro ao atualizar tenant no Supabase:', error);
      throw error;
    }
  },

  /**
   * Inativa um cliente e todas as suas dependências
   * - Inativa o tenant (status = 'INACTIVE')
   * - Inativa todos os fluxos de integração (active = false)
   * - Exclui todas as credenciais
   */
  async deactivate(id: string): Promise<void> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado. Configure as variáveis de ambiente.');
    }

    try {
      // 1. Inativar todos os fluxos de integração do tenant
      const { error: flowsError } = await supabase
        .from('integration_flows')
        .update({ active: false })
        .eq('tenant_id', id);

      if (flowsError) {
        console.error('Erro ao inativar fluxos:', flowsError);
        throw new Error('Erro ao inativar fluxos de integração');
      }

      // 2. Excluir todas as credenciais do tenant
      const { error: credentialsError } = await supabase
        .from('tenant_credentials')
        .delete()
        .eq('tenant_id', id);

      if (credentialsError) {
        console.error('Erro ao excluir credenciais:', credentialsError);
        throw new Error('Erro ao excluir credenciais');
      }

      // 3. Atualizar status do tenant para INACTIVE
      const { error: tenantError } = await supabase
        .from('tenants')
        .update({ status: 'INACTIVE' })
        .eq('id', id);

      if (tenantError) {
        console.error('Erro ao inativar tenant:', tenantError);
        throw new Error('Erro ao inativar cliente');
      }
    } catch (error) {
      console.error('Erro ao inativar tenant no Supabase:', error);
      throw error;
    }
  },

  /**
   * Ativa um cliente previamente inativado
   * - Ativa o tenant (status = 'ACTIVE')
   */
  async activate(id: string): Promise<Tenant> {
    if (!isSupabaseConfigured()) {
      throw new Error('Supabase não está configurado. Configure as variáveis de ambiente.');
    }

    try {
      const { data, error } = await supabase
        .from('tenants')
        .update({ status: 'ACTIVE' })
        .eq('id', id)
        .select()
        .single();

      if (error) {
        console.error('Erro ao ativar tenant no Supabase:', error);
        throw error;
      }

      return {
        id: data.id,
        name: data.name,
        cnpj: data.cnpj,
        email: data.email,
        razaoSocial: data.razao_social,
        nomeFantasia: data.nome_fantasia,
        phone: data.phone,
        address: data.address_logradouro ? {
          logradouro: data.address_logradouro,
          numero: data.address_numero,
          bairro: data.address_bairro,
          cidade: data.address_cidade,
          estado: data.address_estado,
          cep: data.address_cep,
        } : undefined,
        status: data.status,
        plan: data.plan,
        joinedAt: data.created_at,
        connections: {
          contaAzul: data.connections_conta_azul
        }
      };
    } catch (error) {
      console.error('Erro ao ativar tenant no Supabase:', error);
      throw error;
    }
  }
};