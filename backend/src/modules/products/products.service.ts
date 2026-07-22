import { Injectable, NotFoundException } from '@nestjs/common';
import { CreateProductDto } from './dto/create-product.dto';
import { CreatePriceTableDto } from './dto/create-price-table.dto';
import { CreateCategoryDto } from './dto/create-category.dto';
import { AttachProductMediaDto } from './dto/attach-product-media.dto';
import { ProductsRepository } from './products.repository';

@Injectable()
export class ProductsService {
  constructor(private repo: ProductsRepository) {}

  // --- Categories ---

  async createCategoria(dto: CreateCategoryDto) {
    const [result] = await this.repo.createCategoria({ name: dto.name });
    return result;
  }

  async listCategorias() {
    return this.repo.findAllCategorias();
  }

  async updateCategoria(id: string, dto: Partial<CreateCategoryDto>) {
    const [existing] = await this.repo.findCategoriaById(id);

    if (!existing) {
      throw new NotFoundException(`Categoria ${id} não encontrada`);
    }

    const [updated] = await this.repo.updateCategoria(id, {
      ...dto,
      updatedAt: new Date(),
    });

    return updated;
  }

  async deleteCategoria(id: string) {
    const [existing] = await this.repo.findCategoriaById(id);

    if (!existing) {
      throw new NotFoundException(`Categoria ${id} não encontrada`);
    }

    await this.repo.softDeleteCategoria(id);
    return { message: 'Categoria removida com sucesso' };
  }

  // --- Products ---

  async create(dto: CreateProductDto) {
    const [result] = await this.repo.createProduto({
      name: dto.name,
      categoryId: dto.categoryId,
      description: dto.description,
      unit: dto.unit,
    });
    return result;
  }

  async findAll(query: { pagina?: number; limite?: number }) {
    const pagina = query.pagina ?? 1;
    const limite = query.limite ?? 20;

    const { rows, total } = await this.repo.findAllProdutos(pagina, limite);
    return { data: rows, total, pagina, limite };
  }

  async findOne(id: string) {
    const [product] = await this.repo.findProdutoById(id);

    if (!product) {
      throw new NotFoundException(`Produto ${id} não encontrado`);
    }

    return product;
  }

  async update(id: string, dto: Partial<CreateProductDto>) {
    await this.findOne(id);

    const [updated] = await this.repo.updateProduto(id, {
      ...dto,
      updatedAt: new Date(),
    });

    return updated;
  }

  async softDelete(id: string) {
    await this.findOne(id);
    await this.repo.softDeleteProduto(id);
    return { message: 'Produto removido com sucesso' };
  }

  // --- Price Table ---

  async createPriceEntry(productId: string, dto: CreatePriceTableDto) {
    await this.findOne(productId);

    const [result] = await this.repo.insertPriceEntry({
      productId,
      starRating: dto.starRating,
      minQuantity: String(dto.minQuantity),
      maxQuantity: dto.maxQuantity !== undefined ? String(dto.maxQuantity) : null,
      unitPrice: String(dto.unitPrice),
      maxDiscountPct: String(dto.maxDiscountPct ?? 0),
    });

    return result;
  }

  async listPriceTable(productId: string) {
    await this.findOne(productId);
    return this.repo.findPricesByProduto(productId);
  }

  async updatePriceEntry(id: string, dto: Partial<CreatePriceTableDto>) {
    const updateData: Record<string, any> = { updatedAt: new Date() };

    if (dto.starRating !== undefined) updateData.starRating = dto.starRating;
    if (dto.minQuantity !== undefined) updateData.minQuantity = String(dto.minQuantity);
    if (dto.maxQuantity !== undefined) updateData.maxQuantity = String(dto.maxQuantity);
    if (dto.unitPrice !== undefined) updateData.unitPrice = String(dto.unitPrice);
    if (dto.maxDiscountPct !== undefined) updateData.maxDiscountPct = String(dto.maxDiscountPct);

    const [updated] = await this.repo.updatePriceEntry(id, updateData);

    if (!updated) {
      throw new NotFoundException(`Entrada de tabela de preço ${id} não encontrada`);
    }

    return updated;
  }

  async deletePriceEntry(id: string) {
    const result = await this.repo.deletePriceEntry(id);

    if (result.length === 0) {
      throw new NotFoundException(`Entrada de tabela de preço ${id} não encontrada`);
    }

    return { message: 'Entrada removida com sucesso' };
  }

  // --- Media ---

  async attachMedia(productId: string, dto: AttachProductMediaDto) {
    await this.findOne(productId);

    const [mediaFile] = await this.repo.findMediaFileById(dto.mediaId);

    if (!mediaFile) {
      throw new NotFoundException(`Mídia ${dto.mediaId} não encontrada`);
    }

    const [result] = await this.repo.insertProductMedia({
      productId,
      mediaType: mediaFile.type,
      url: mediaFile.url,
      caption: dto.caption ?? mediaFile.name,
      starRating: dto.starRating,
      order: dto.order ?? 0,
    });

    return result;
  }

  async listMedia(productId: string) {
    await this.findOne(productId);
    return this.repo.findProductMediaByProduto(productId);
  }

  async removeMedia(productId: string, mediaEntryId: string) {
    await this.findOne(productId);

    const [entry] = await this.repo.findProductMediaById(mediaEntryId);

    if (!entry || entry.productId !== productId) {
      throw new NotFoundException(`Mídia ${mediaEntryId} não encontrada para este produto`);
    }

    await this.repo.deleteProductMedia(mediaEntryId);
    return { message: 'Mídia removida do produto com sucesso' };
  }
}
